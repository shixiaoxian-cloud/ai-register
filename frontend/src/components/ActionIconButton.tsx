import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

type ActionTone = "default" | "accent" | "danger";
type ActionIcon =
  | "view"
  | "edit"
  | "delete"
  | "open"
  | "download"
  | "logs"
  | "select";

interface BaseProps {
  icon: ActionIcon;
  label: string;
  tone?: ActionTone;
  className?: string;
}

type ButtonVariantProps = BaseProps & {
  href?: undefined;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

type LinkVariantProps = BaseProps & {
  href: string;
  onClick?: AnchorHTMLAttributes<HTMLAnchorElement>["onClick"];
  target?: string;
  rel?: string;
  download?: boolean;
};

function iconFor(name: ActionIcon): ReactNode {
  switch (name) {
    case "view":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M1.5 10c1.8-3.4 4.7-5.1 8.5-5.1S16.7 6.6 18.5 10c-1.8 3.4-4.7 5.1-8.5 5.1S3.3 13.4 1.5 10Z" />
          <circle cx="10" cy="10" r="2.8" />
        </svg>
      );
    case "edit":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M13.8 2.8a2.1 2.1 0 0 1 3 3l-8.9 8.9-4 1 1-4 8.9-8.9Z" />
          <path d="M12.3 4.3 15.7 7.7" />
        </svg>
      );
    case "delete":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 5.5h13" />
          <path d="M7.5 2.8h5" />
          <path d="M6.2 5.5v9.2c0 .8.6 1.5 1.4 1.5h4.8c.8 0 1.4-.7 1.4-1.5V5.5" />
          <path d="M8.3 8.2v5.1" />
          <path d="M11.7 8.2v5.1" />
        </svg>
      );
    case "open":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 4.5H4.7A1.7 1.7 0 0 0 3 6.2v9.1A1.7 1.7 0 0 0 4.7 17h9.1a1.7 1.7 0 0 0 1.7-1.7V12" />
          <path d="M11 4h5v5" />
          <path d="M8.5 11.5 16 4" />
        </svg>
      );
    case "download":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.2v8.3" />
          <path d="m6.8 8.8 3.2 3.2 3.2-3.2" />
          <path d="M3.7 15.5h12.6" />
        </svg>
      );
    case "logs":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5.2h12" />
          <path d="M4 9.8h12" />
          <path d="M4 14.4h7.4" />
        </svg>
      );
    case "select":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m4.4 10.4 3.1 3.1 8.1-8.1" />
        </svg>
      );
    default:
      return null;
  }
}

function stopRowEvent(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function ActionIconButton(props: ButtonVariantProps | LinkVariantProps) {
  const tone = props.tone || "default";
  const className = ["icon-action", `icon-action--${tone}`, props.className]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href) {
    const { href, label, icon, onClick, target, rel, download } = props;
    return (
      <a
        href={href}
        className={className}
        aria-label={label}
        title={label}
        target={target}
        rel={rel}
        download={download}
        onClick={(event) => {
          stopRowEvent(event);
          onClick?.(event);
        }}
      >
        {iconFor(icon)}
      </a>
    );
  }

  const buttonProps = props as ButtonVariantProps;
  const { label, icon, onClick, disabled, type = "button" } = buttonProps;
  return (
    <button
      type={type}
      className={className}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        stopRowEvent(event);
        onClick?.(event);
      }}
    >
      {iconFor(icon)}
    </button>
  );
}
