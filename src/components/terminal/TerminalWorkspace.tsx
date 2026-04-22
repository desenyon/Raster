import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TerminalPane } from "./TerminalPane";

export type TabModel = {
  id: string;
  title: string;
  dead?: boolean;
  error?: string | null;
  sessionShort?: string | null;
};

function newTabTitle(n: number) {
  return `Shell ${n}`;
}

const boot = (() => {
  const id = crypto.randomUUID();
  return {
    id,
    tabs: [{ id, title: newTabTitle(1), sessionShort: null }] as TabModel[],
  };
})();

type Props = {
  onRegisterAddTab?: (addTab: () => void) => void;
  onBlockLogged?: () => void;
};

export function TerminalWorkspace({ onRegisterAddTab, onBlockLogged }: Props) {
  const [tabs, setTabs] = useState<TabModel[]>(boot.tabs);
  const [activeId, setActiveId] = useState<string>(boot.id);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeId) ?? tabs[0]!, [tabs, activeId]);

  const addTab = useCallback(() => {
    const id = crypto.randomUUID();
    setTabs((prev) => {
      const t: TabModel = { id, title: newTabTitle(prev.length + 1), sessionShort: null };
      return [...prev, t];
    });
    setActiveId(id);
  }, []);

  useEffect(() => {
    onRegisterAddTab?.(addTab);
  }, [onRegisterAddTab, addTab]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) => (cur === id ? next[0]!.id : cur));
      return next;
    });
  }, []);

  const onSession = useCallback((tabId: string, sessionId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, sessionShort: sessionId.slice(0, 8), dead: false, error: null } : t,
      ),
    );
  }, []);

  const onExit = useCallback((tabId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, dead: true, sessionShort: null } : t)));
  }, []);

  const onErr = useCallback((tabId: string, message: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, dead: true, error: message } : t)));
  }, []);

  return (
    <div className="rs-term-workspace">
      <nav className="rs-vtab-rail" aria-label="Terminal sessions">
        <div className="rs-vtab-rail-inner">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rs-vtab ${t.id === activeId ? "rs-vtab-active" : ""} ${t.dead ? "rs-vtab-dead" : ""}`}
              onClick={() => setActiveId(t.id)}
              title={t.title}
            >
              <span className="rs-vtab-glyph" aria-hidden />
              <span className="rs-vtab-label">{t.title.replace("Shell ", "")}</span>
              {tabs.length > 1 ? (
                <span
                  className="rs-vtab-close"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeTab(t.id);
                    }
                  }}
                  title="Close tab"
                >
                  <X size={12} strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <button type="button" className="rs-vtab-add" onClick={addTab} title="New terminal tab">
          <Plus size={16} strokeWidth={2} />
        </button>
      </nav>
      <div className="rs-terminal-stack">
        {tabs.map((t) => (
          <TerminalPane
            key={t.id}
            tabId={t.id}
            active={t.id === activeId}
            onSession={(sid) => onSession(t.id, sid)}
            onExit={() => onExit(t.id)}
            onError={(msg) => onErr(t.id, msg)}
            onBlockLogged={onBlockLogged}
          />
        ))}
      </div>
      <div className="rs-term-chrome-footer">
        <span className={`rs-term-chrome-pill ${activeTab.dead || activeTab.error ? "rs-pill-warn" : "rs-pill-ok"}`}>
          {activeTab.error ? "error" : activeTab.dead ? "disconnected" : "live"}
        </span>
        <span className="rs-term-chrome-meta mono">
          {activeTab.error
            ? activeTab.error
            : activeTab.sessionShort
              ? `session ${activeTab.sessionShort}`
              : "connecting…"}
        </span>
      </div>
    </div>
  );
}
