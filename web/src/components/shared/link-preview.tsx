/**
 * LinkPreview — 카드형 링크 프리뷰.
 * [썸네일 | 타이틀 + URL + 설명] 레이아웃.
 * 이미지 없을 때 도메인 첫 글자 아이콘 표시.
 */

export interface LinkPreviewProps {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  className?: string;
}

function domain_from_url(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function domain_initial(url: string): string {
  const d = domain_from_url(url);
  return d.charAt(0).toUpperCase();
}

export function LinkPreview({ url, title, description, image, className }: LinkPreviewProps) {
  const domain = domain_from_url(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-preview${className ? ` ${className}` : ""}`}
      aria-label={title ?? url}
    >
      {/* Thumbnail */}
      <div className="link-preview__thumbnail">
        {image ? (
          <img
            className="link-preview__image"
            src={image}
            alt={title ?? domain}
            loading="lazy"
          />
        ) : (
          <div className="link-preview__icon-fallback" aria-hidden="true">
            {domain_initial(url)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="link-preview__content">
        {title && <span className="link-preview__title">{title}</span>}
        <span className="link-preview__url">{domain}</span>
        {description && (
          <span className="link-preview__description">{description}</span>
        )}
      </div>
    </a>
  );
}
