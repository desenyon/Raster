import { PtySessionPane, type PtySessionPaneProps } from "./PtySessionPane";

export type TerminalPaneProps = Omit<PtySessionPaneProps, "paneKey"> & {
  tabId: string;
};

export function TerminalPane({ tabId, ...rest }: TerminalPaneProps) {
  return <PtySessionPane paneKey={tabId} {...rest} />;
}
