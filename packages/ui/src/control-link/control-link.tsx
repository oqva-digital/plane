import * as React from "react";

export type TControlLink = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
  target?: string;
  disabled?: boolean;
  className?: string;
  draggable?: boolean;
};

export const ControlLink = React.forwardRef(function ControlLink(
  props: TControlLink,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { href, onClick, children, target = "_blank", disabled = false, className, draggable = false, ...rest } = props;
  const LEFT_CLICK_EVENT_CODE = 0;

  const handleOnClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    const clickCondition = (event.metaKey || event.ctrlKey) && event.button === LEFT_CLICK_EVENT_CODE;
    if (!clickCondition) {
      event.preventDefault();
      onClick(event);
    }
  };

  // if disabled but still has a ref or a className then render with inert href for a11y
  if (disabled && (ref || className))
    return (
      // eslint-disable-next-line jsx-a11y/anchor-is-valid -- disabled link rendered as placeholder
      <a ref={ref} className={className} href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}>
        {children}
      </a>
    );

  // else if just disabled return without the parent wrapper
  if (disabled) return <>{children}</>;

  return (
    <a
      href={href}
      target={target}
      onClick={handleOnClick}
      ref={ref}
      className={className}
      draggable={draggable}
      {...rest}
    >
      {children}
    </a>
  );
});

ControlLink.displayName = "ControlLink";
