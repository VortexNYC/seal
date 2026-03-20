import { forwardRef, type PropsWithChildren } from "react";

type RemoveScrollProps = PropsWithChildren<{
  enabled?: boolean;
  removeScrollBar?: boolean;
}>;

export const RemoveScroll = forwardRef<HTMLElement, RemoveScrollProps>(function RemoveScroll(
  { children },
  _ref,
) {
  return children;
});

export default RemoveScroll;
