import React from 'react';
import { useTranslation } from 'react-i18next';

interface ModelOverviewSectionProps {
  model: any;
}

export default function ModelOverviewSection({ model }: ModelOverviewSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        {t('models.detail.overview.modelInfo', 'Model Information')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <InfoItem
          label={t('models.detail.overview.modelId', 'Model ID')}
          value={model?.id || '-'}
          mono
        />
        <InfoItem
          label={t('models.detail.overview.type', 'Type')}
          value={model?.type || 'chat'}
        />
        <InfoItem
          label={t('models.detail.overview.provider', 'Provider')}
          value={model?.owned_by || '-'}
        />
        <InfoItem
          label={t('models.detail.overview.status', 'Status')}
          value={model?.status || 'active'}
          badge
          badgeColor="green"
        />
        {model?.context_length && (
          <InfoItem
            label={t('models.detail.overview.contextLength', 'Context Length')}
            value={`${(model.context_length / 1000).toFixed(0)}K tokens`}
          />
        )}
        {model?.max_output_length && (
          <InfoItem
            label={t('models.detail.overview.maxOutput', 'Max Output')}
            value={`${(model.max_output_length / 1000).toFixed(0)}K tokens`}
          />
        )}
      </div>

      {/* Description */}
      {model?.description && (
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('models.detail.overview.description', 'Description')}
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {model.description}
          </p>
        </div>
      )}

      {/* Supported Features */}
      {model?.supported_features && model.supported_features.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            {t('models.detail.overview.features', 'Supported Features')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {model.supported_features.map((feature: string) => (
              <span
                key={feature}
                className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
function InfoItem({
  label,
  value,
  mono,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
  badgeColor?: string;
}) {
  const colorMap: Record<string, string> = {
    green:
      'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    yellow:
      'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  };

  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </div>
      {badge ? (
        <span
          className={`px-2 py-0.5 text-xs rounded-full ${
            colorMap[badgeColor || 'green']
          }`}
        >
          {value}
        </span>
      ) : (
        <div
          className={`text-sm font-medium text-gray-900 dark:text-white ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}
