package mode

import "fmt"

type Mode int

func (m Mode) String() string {
	switch m {
	case Unknown:
		return "Unknown"
	case ChatCompletions:
		return "ChatCompletions"
	case Completions:
		return "Completions"
	case Embeddings:
		return "Embeddings"
	case Moderations:
		return "Moderations"
	case ImagesGenerations:
		return "ImagesGenerations"
	case ImagesEdits:
		return "ImagesEdits"
	case AudioSpeech:
		return "AudioSpeech"
	case AudioTranscription:
		return "AudioTranscription"
	case AudioTranslation:
		return "AudioTranslation"
	case Rerank:
		return "Rerank"
	case ParsePdf:
		return "ParsePdf"
	case Anthropic:
		return "Anthropic"
	case VideoGenerationsJobs:
		return "VideoGenerationsJobs"
	case VideoGenerationsGetJobs:
		return "VideoGenerationsGetJobs"
	case VideoGenerationsContent:
		return "VideoGenerationsContent"
	case Responses:
		return "Responses"
	case ResponsesGet:
		return "ResponsesGet"
	case ResponsesDelete:
		return "ResponsesDelete"
	case ResponsesCancel:
		return "ResponsesCancel"
	case ResponsesInputItems:
		return "ResponsesInputItems"
	case Gemini:
		return "Gemini"
	default:
		return fmt.Sprintf("Mode(%d)", m)
	}
}

const (
	Unknown Mode = iota
	ChatCompletions
	Completions
	Embeddings
	Moderations
	ImagesGenerations
	ImagesEdits
	AudioSpeech
	AudioTranscription
	AudioTranslation
	Rerank
	ParsePdf
	Anthropic
	VideoGenerationsJobs
	VideoGenerationsGetJobs
	VideoGenerationsContent
	Responses
	ResponsesGet
	ResponsesDelete
	ResponsesCancel
	ResponsesInputItems
	Gemini
)

func (m Mode) IsChatLike() bool {
	switch m {
	case ChatCompletions,
		Completions,
		Anthropic,
		Gemini,
		Responses,
		ResponsesGet,
		ResponsesDelete,
		ResponsesCancel,
		ResponsesInputItems:
		return true
	default:
		return false
	}
}

func (m Mode) IsImageLike() bool {
	switch m {
	case ImagesGenerations, ImagesEdits:
		return true
	default:
		return false
	}
}

func (m Mode) IsVideoLike() bool {
	switch m {
	case VideoGenerationsJobs, VideoGenerationsGetJobs, VideoGenerationsContent:
		return true
	default:
		return false
	}
}

func (m Mode) SupportsStreamTimeout() bool {
	switch m {
	case ChatCompletions, Completions, Anthropic, Responses, Gemini:
		return true
	default:
		return false
	}
}

func (m Mode) IsCompatibleWith(requestMode Mode) bool {
	if m == Unknown {
		return true
	}

	switch {
	case requestMode.IsChatLike():
		return m.IsChatLike()
	case requestMode.IsImageLike():
		return m.IsImageLike()
	case requestMode.IsVideoLike():
		return m.IsVideoLike()
	default:
		return requestMode == m
	}
}
