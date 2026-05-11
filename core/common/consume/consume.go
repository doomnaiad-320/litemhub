package consume

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/labring/aiproxy/core/common/balance"
	"github.com/labring/aiproxy/core/common/notify"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/meta"
	"github.com/labring/aiproxy/core/relay/mode"
	"github.com/shopspring/decimal"
	log "github.com/sirupsen/logrus"
)

var consumeWaitGroup sync.WaitGroup

func Wait() {
	consumeWaitGroup.Wait()
}

func AsyncConsume(
	postGroupConsumer balance.PostGroupConsumer,
	code int,
	firstByteAt time.Time,
	meta *meta.Meta,
	usage model.Usage,
	modelPrice model.Price,
	content string,
	ip string,
	retryTimes int,
	requestDetail *model.RequestDetail,
	downstreamResult bool,
	metadata map[string]string,
	upstreamID string,
	asyncUsageStatus model.AsyncUsageStatus,
) {
	if !checkNeedRecordConsume(code, meta) {
		return
	}

	consumeWaitGroup.Add(1)
	defer func() {
		consumeWaitGroup.Done()

		if r := recover(); r != nil {
			log.Errorf("panic in consume: %v", r)
		}
	}()

	go Consume(
		context.Background(),
		time.Now(),
		postGroupConsumer,
		firstByteAt,
		code,
		meta,
		usage,
		modelPrice,
		content,
		ip,
		retryTimes,
		requestDetail,
		downstreamResult,
		metadata,
		upstreamID,
		asyncUsageStatus,
	)
}

func Consume(
	ctx context.Context,
	now time.Time,
	postGroupConsumer balance.PostGroupConsumer,
	firstByteAt time.Time,
	code int,
	meta *meta.Meta,
	usage model.Usage,
	modelPrice model.Price,
	content string,
	ip string,
	retryTimes int,
	requestDetail *model.RequestDetail,
	downstreamResult bool,
	metadata map[string]string,
	upstreamID string,
	asyncUsageStatus model.AsyncUsageStatus,
) {
	if !checkNeedRecordConsume(code, meta) {
		return
	}

	amountDetail := CalculateAmountDetail(code, usage, modelPrice, meta.RequestServiceTier)
	if downstreamResult {
		// TODO: add record actual consume amount
		_ = consumeAmount(ctx, amountDetail.UsedAmount, postGroupConsumer, meta)
	} else if amountDetail.UsedAmount != 0 {
		log.Warnf(
			"not downstream result but used amount is not zero, request_id: %s, used_amount: %f",
			meta.RequestID,
			amountDetail.UsedAmount,
		)
	}

	selectedPrice := modelPrice.SelectConditionalPriceWithInfo(usage, meta.RequestServiceTier)
	selectedModelPrice := selectedPrice.Price
	selectedModelPrice.ConditionalPrices = nil
	metadata = withConditionalPriceMetadata(metadata, selectedPrice)

	err := recordConsume(
		now,
		meta,
		code,
		firstByteAt,
		usage,
		selectedModelPrice,
		content,
		ip,
		requestDetail,
		amountDetail,
		retryTimes,
		downstreamResult,
		metadata,
		upstreamID,
		asyncUsageStatus,
	)
	if err != nil {
		log.Error("error batch record consume: " + err.Error())
		notify.ErrorThrottle("recordConsume", time.Minute*5, "record consume failed", err.Error())
	}
}

func withConditionalPriceMetadata(
	metadata map[string]string,
	selectedPrice model.SelectedConditionalPrice,
) map[string]string {
	if !selectedPrice.Matched {
		return metadata
	}

	if metadata == nil {
		metadata = make(map[string]string)
	}

	condition := selectedPrice.Condition
	metadata["price_source"] = "conditional_prices"
	metadata["price_condition_index"] = strconv.Itoa(selectedPrice.Index)
	metadata["price_condition_number"] = strconv.Itoa(selectedPrice.Index + 1)

	setInt64Metadata := func(key string, value int64) {
		if value > 0 {
			metadata[key] = strconv.FormatInt(value, 10)
		}
	}

	setInt64Metadata("price_condition_input_token_min", condition.InputTokenMin)
	setInt64Metadata("price_condition_input_token_max", condition.InputTokenMax)
	setInt64Metadata("price_condition_output_token_min", condition.OutputTokenMin)
	setInt64Metadata("price_condition_output_token_max", condition.OutputTokenMax)
	setInt64Metadata("price_condition_start_time", condition.StartTime)
	setInt64Metadata("price_condition_end_time", condition.EndTime)
	if condition.ServiceTier != "" {
		metadata["price_condition_service_tier"] = condition.ServiceTier
	}

	return metadata
}

func Summary(
	code int,
	firstByteAt time.Time,
	meta *meta.Meta,
	usage model.Usage,
	modelPrice model.Price,
	downstreamResult bool,
) {
	amountDetail := CalculateAmountDetail(code, usage, modelPrice, meta.RequestServiceTier)

	recordSummary(
		time.Now(),
		meta,
		code,
		firstByteAt,
		usage,
		amountDetail,
		downstreamResult,
		meta.RequestServiceTier,
	)
}

func checkNeedRecordConsume(code int, meta *meta.Meta) bool {
	switch meta.Mode {
	case mode.VideoGenerationsGetJobs,
		mode.VideoGenerationsContent,
		mode.ResponsesGet,
		mode.ResponsesDelete,
		mode.ResponsesCancel,
		mode.ResponsesInputItems:
		return code != http.StatusOK
	default:
		return true
	}
}

func consumeAmount(
	ctx context.Context,
	amount float64,
	postGroupConsumer balance.PostGroupConsumer,
	meta *meta.Meta,
) float64 {
	if amount > 0 && postGroupConsumer != nil {
		return processGroupConsume(ctx, amount, postGroupConsumer, meta)
	}
	return amount
}

func CalculateAmountDetail(
	code int,
	usage model.Usage,
	modelPrice model.Price,
	serviceTier string,
) model.Amount {
	if modelPrice.PerRequestPrice != 0 {
		if code != http.StatusOK {
			return model.Amount{}
		}

		return model.Amount{
			UsedAmount: float64(modelPrice.PerRequestPrice),
		}
	}

	modelPrice = modelPrice.SelectConditionalPrice(usage, serviceTier)

	requestAmount := calculateRequestAmount(code, usage, modelPrice)

	inputTokens := usage.InputTokens
	if modelPrice.ImageInputPrice > 0 {
		inputTokens -= usage.ImageInputTokens
	}

	if modelPrice.AudioInputPrice > 0 {
		inputTokens -= usage.AudioInputTokens
	}

	if modelPrice.CachedPrice > 0 {
		inputTokens -= usage.CachedTokens
	}

	if modelPrice.CacheCreationPrice > 0 {
		inputTokens -= usage.CacheCreationTokens
	}

	outputTokens := usage.OutputTokens
	if modelPrice.ImageOutputPrice > 0 {
		outputTokens -= usage.ImageOutputTokens
	}

	outputPrice := float64(modelPrice.OutputPrice)

	outputPriceUnit := modelPrice.GetOutputPriceUnit()
	if usage.ReasoningTokens != 0 && modelPrice.ThinkingModeOutputPrice != 0 {
		outputPrice = float64(modelPrice.ThinkingModeOutputPrice)
		if modelPrice.ThinkingModeOutputPriceUnit != 0 {
			outputPriceUnit = int64(modelPrice.ThinkingModeOutputPriceUnit)
		}
	}

	inputAmount := decimal.NewFromInt(int64(inputTokens)).
		Mul(decimal.NewFromFloat(float64(modelPrice.InputPrice))).
		Div(decimal.NewFromInt(modelPrice.GetInputPriceUnit()))

	imageInputAmount := decimal.NewFromInt(int64(usage.ImageInputTokens)).
		Mul(decimal.NewFromFloat(float64(modelPrice.ImageInputPrice))).
		Div(decimal.NewFromInt(modelPrice.GetImageInputPriceUnit()))

	audioInputAmount := decimal.NewFromInt(int64(usage.AudioInputTokens)).
		Mul(decimal.NewFromFloat(float64(modelPrice.AudioInputPrice))).
		Div(decimal.NewFromInt(modelPrice.GetAudioInputPriceUnit()))

	cachedAmount := decimal.NewFromInt(int64(usage.CachedTokens)).
		Mul(decimal.NewFromFloat(float64(modelPrice.CachedPrice))).
		Div(decimal.NewFromInt(modelPrice.GetCachedPriceUnit()))

	cacheCreationAmount := decimal.NewFromInt(int64(usage.CacheCreationTokens)).
		Mul(decimal.NewFromFloat(float64(modelPrice.CacheCreationPrice))).
		Div(decimal.NewFromInt(modelPrice.GetCacheCreationPriceUnit()))

	webSearchAmount := decimal.NewFromInt(int64(usage.WebSearchCount)).
		Mul(decimal.NewFromFloat(float64(modelPrice.WebSearchPrice))).
		Div(decimal.NewFromInt(modelPrice.GetWebSearchPriceUnit()))

	outputAmount := decimal.NewFromInt(int64(outputTokens)).
		Mul(decimal.NewFromFloat(outputPrice)).
		Div(decimal.NewFromInt(outputPriceUnit))

	imageOutputAmount := decimal.NewFromInt(int64(usage.ImageOutputTokens)).
		Mul(decimal.NewFromFloat(float64(modelPrice.ImageOutputPrice))).
		Div(decimal.NewFromInt(modelPrice.GetImageOutputPriceUnit()))

	usedAmount := inputAmount.
		Add(requestAmount.input).
		Add(requestAmount.output).
		Add(imageInputAmount).
		Add(audioInputAmount).
		Add(cachedAmount).
		Add(cacheCreationAmount).
		Add(webSearchAmount).
		Add(outputAmount).
		Add(imageOutputAmount).
		InexactFloat64()

	return model.Amount{
		InputRequestAmount:  requestAmount.input.InexactFloat64(),
		OutputRequestAmount: requestAmount.output.InexactFloat64(),
		InputAmount:         inputAmount.InexactFloat64(),
		ImageInputAmount:    imageInputAmount.InexactFloat64(),
		AudioInputAmount:    audioInputAmount.InexactFloat64(),
		OutputAmount:        outputAmount.InexactFloat64(),
		ImageOutputAmount:   imageOutputAmount.InexactFloat64(),
		CachedAmount:        cachedAmount.InexactFloat64(),
		CacheCreationAmount: cacheCreationAmount.InexactFloat64(),
		WebSearchAmount:     webSearchAmount.InexactFloat64(),
		UsedAmount:          usedAmount,
	}
}

type requestAmount struct {
	input  decimal.Decimal
	output decimal.Decimal
}

func calculateRequestAmount(
	code int,
	usage model.Usage,
	modelPrice model.Price,
) requestAmount {
	if code != http.StatusOK {
		return requestAmount{}
	}

	var amount requestAmount
	if modelPrice.InputRequestPrice > 0 {
		amount.input = decimal.NewFromFloat(float64(modelPrice.InputRequestPrice))
	}
	if modelPrice.OutputRequestPrice > 0 && usage.OutputTokens > 0 {
		amount.output = decimal.NewFromFloat(float64(modelPrice.OutputRequestPrice))
	}

	return amount
}

func CalculateAmount(
	code int,
	usage model.Usage,
	modelPrice model.Price,
	serviceTier string,
) float64 {
	return CalculateAmountDetail(code, usage, modelPrice, serviceTier).UsedAmount
}

func processGroupConsume(
	ctx context.Context,
	amount float64,
	postGroupConsumer balance.PostGroupConsumer,
	meta *meta.Meta,
) float64 {
	consumedAmount, err := postGroupConsumer.PostGroupConsume(ctx, meta.Token.Name, amount)
	if err != nil {
		log.Error("error consuming token remain amount: " + err.Error())

		if err := model.CreateConsumeError(
			meta.RequestID,
			meta.RequestAt,
			meta.Group.ID,
			meta.Token.Name,
			meta.OriginModel,
			err.Error(),
			amount,
			meta.Token.ID,
		); err != nil {
			log.Error("failed to create consume error: " + err.Error())
		}

		return amount
	}

	return consumedAmount
}
