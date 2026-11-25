"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { groups, sections } from "../features/navigation";
import { sessionAction } from "../lib/api";
import type { Session } from "../lib/contracts";
import { ErrorNotice } from "./ui";

type Theme = "light" | "dark" | "system";
const useUi = create<{
  navigation: boolean;
  theme: Theme;
  setNavigation: (value: boolean) => void;
  setTheme: (value: Theme) => void;
}>((set) => ({
  navigation: false,
  theme: "system",
  setNavigation: (navigation) => set({ navigation }),
  setTheme: (theme) => set({ theme }),
}));

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Building2 size={21} strokeWidth={1.8} />
      </span>
      <span>
        PGListings<small>ADMIN WORKSPACE</small>
      </span>
    </div>
  );
}

function Navigation({ close }: { close?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="nav-groups">
      {groups.map((group) => (
        <div className="nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.links.map(({ id, title, icon: Icon }) => (
            <Link
              key={id}
              href={`/${id}`}
              aria-current={path === `/${id}` ? "page" : undefined}
              onClick={close}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{title}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Shell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { navigation, theme, setNavigation, setTheme } = useUi();
  const [offline, setOffline] = useState(false);
  const [expired, setExpired] = useState(false);
  const active = sections.find(({ id }) => pathname === `/${id}`);
  const signOut = useMutation({
    mutationFn: () => sessionAction("DELETE"),
    onSuccess: () => {
      queryClient.clear();
      window.location.replace("/sign-in");
    },
  });

  useEffect(() => {
    const initialTheme = document.documentElement.dataset.theme;
    if (initialTheme === "light" || initialTheme === "dark")
      setTheme(initialTheme);
    const expired = () => setExpired(true);
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("admin-session-expired", expired);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("admin-session-expired", expired);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setTheme]);

  function applyTheme(value: Theme) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("pg-admin-theme", value);
    } catch {
      /* Storage may be disabled. */
    }
  }
  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <Navigation />
        <div className="sidebar-foot">
          <span className="avatar">{initials}</span>
          <div>
            {session.user.name}
            <small>Administrator</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="crumb">
            <Dialog.Root open={navigation} onOpenChange={setNavigation}>
              <Dialog.Trigger asChild>
                <button
                  className="icon-button mobile-menu"
                  aria-label="Open navigation"
                >
                  <Menu size={22} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="overlay" />
                <Dialog.Content className="drawer" aria-describedby={undefined}>
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <div className="drawer-head">
                    <Brand />
                    <Dialog.Close asChild>
                      <button
                        className="icon-button"
                        aria-label="Close navigation"
                      >
                        <X size={20} />
                      </button>
                    </Dialog.Close>
                  </div>
                  <Navigation close={() => setNavigation(false)} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="crumb-root">Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{active?.title}</strong>
          </div>
          <div className="top-actions">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="icon-button" aria-label="Change color theme">
                  {theme === "dark" ? (
                    <Moon size={19} />
                  ) : theme === "light" ? (
                    <Sun size={19} />
                  ) : (
                    <Monitor size={19} />
                  )}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="menu"
                  sideOffset={8}
                  align="end"
                >
                  <DropdownMenu.RadioGroup
                    value={theme}
                    onValueChange={(value) => {
                      if (
                        value === "system" ||
                        value === "light" ||
                        value === "dark"
                      )
                        applyTheme(value);
                    }}
                  >
                    {(["system", "light", "dark"] as const).map((value) => (
                      <DropdownMenu.RadioItem
                        className="menu-item"
                        key={value}
                        value={value}
                      >
                        <DropdownMenu.ItemIndicator>
                          ✓
                        </DropdownMenu.ItemIndicator>
                        {value[0].toUpperCase() + value.slice(1)}
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="account-trigger" aria-label="Account menu">
                  <span className="avatar">{initials}</span>
                  <ChevronDown size={15} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="menu"
                  sideOffset={8}
                  align="end"
                >
                  <DropdownMenu.Label className="menu-label">
                    {session.user.name}
                  </DropdownMenu.Label>
                  <DropdownMenu.Item
                    className="menu-item"
                    disabled={signOut.isPending}
                    onSelect={() => signOut.mutate()}
                  >
                    <LogOut size={16} /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {offline && (
            <p className="notice" role="status">
              Connection lost. Showing any records already loaded.
            </p>
          )}
          {expired && (
            <div className="notice" role="alert">
              Your session ended.{" "}
              <a href="/sign-in" target="_blank" rel="noopener noreferrer">
                Sign in in a new tab
              </a>
              , then{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setExpired(false);
                  void queryClient.invalidateQueries();
                  router.refresh();
                }}
              >
                reconnect this workspace
              </button>{" "}
              to keep open form values.
            </div>
          )}
          {signOut.isError && <ErrorNotice error={signOut.error} />}
          {children}
        </main>
      </div>
    </div>
  );
}
