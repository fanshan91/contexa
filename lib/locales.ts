export type ProjectLocaleOption = {
  value: string;
  label: string;
};

export const projectLocaleOptions: ProjectLocaleOption[] = [
  { value: 'zh-CN', label: '简体中文 (zh-CN)' },
  { value: 'zh-TW', label: '繁體中文 (zh-TW)' },
  { value: 'en', label: 'English (en)' },
  { value: 'ja', label: '日本語 (ja)' },
  { value: 'ko', label: '한국어 (ko)' },
  { value: 'fr', label: 'Français (fr)' },
  { value: 'de', label: 'Deutsch (de)' },
  { value: 'es', label: 'Español (es)' },
  { value: 'it', label: 'Italiano (it)' },
  { value: 'pt-BR', label: 'Português (Brasil) (pt-BR)' },
  { value: 'pt-PT', label: 'Português (Portugal) (pt-PT)' },
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'ar', label: 'العربية (ar)' },
  { value: 'hi', label: 'हिन्दी (hi)' },
  { value: 'th', label: 'ไทย (th)' },
  { value: 'vi', label: 'Tiếng Việt (vi)' },
  { value: 'id', label: 'Bahasa Indonesia (id)' },
  { value: 'tr', label: 'Türkçe (tr)' },
  { value: 'nl', label: 'Nederlands (nl)' },
  { value: 'sv', label: 'Svenska (sv)' },
  { value: 'no', label: 'Norsk (no)' },
  { value: 'da', label: 'Dansk (da)' },
  { value: 'fi', label: 'Suomi (fi)' },
  { value: 'pl', label: 'Polski (pl)' },
  { value: 'cs', label: 'Čeština (cs)' },
  { value: 'uk', label: 'Українська (uk)' },
  { value: 'he', label: 'עברית (he)' }
];

const projectLocaleLabelByValue = new Map(projectLocaleOptions.map((opt) => [opt.value, opt.label]));

export function getProjectLocaleLabel(locale: string) {
  const code = locale.trim();
  if (!code) return '';
  return projectLocaleLabelByValue.get(code) ?? code;
}
