"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/constants";
import api from "@/lib/api";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  icon: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
  time_ago: string;
}

const ROLE_API_PREFIX: Record<number, string> = {
  [ROLES.ADMIN]: "/api/admin",
  [ROLES.DEPARTMENT_HEAD]: "/api/department-head",
  [ROLES.FACULTY]: "/api/faculty",
};

const ROLE_SCHEDULE_REQUEST_PATH: Record<number, string> = {
  [ROLES.ADMIN]: "/admin/schedule-change-requests",
  [ROLES.DEPARTMENT_HEAD]: "/department-head/schedule-change-requests",
  [ROLES.FACULTY]: "/faculty/schedule-change-requests",
};

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const apiPrefix = user ? ROLE_API_PREFIX[user.role] : null;

  const fetchNotifications = useCallback(async () => {
    if (!apiPrefix) return;
    try {
      const res = await api.get(`${apiPrefix}/notifications`, {
        params: { limit: 10, offset: 0 },
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [apiPrefix]);

  // Fetch on mount and every 30 seconds
  useEffect(() => {
    const initialFetchTimeout = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      clearTimeout(initialFetchTimeout);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  function toggleDropdown() {
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleClick = () => {
    toggleDropdown();
  };

  const handleMarkAllRead = async () => {
    if (!apiPrefix) return;
    try {
      await api.post(`${apiPrefix}/notifications/read-all`);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleMarkRead = async (id: number) => {
    if (!apiPrefix) return;
    try {
      await api.post(`${apiPrefix}/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const getScheduleChangeRequestTarget = (notification: NotificationItem): string | null => {
    if (!user) return null;

    const basePath = ROLE_SCHEDULE_REQUEST_PATH[user.role];
    if (!basePath) return null;

    const metadata = notification.metadata;
    const rawRequestId = metadata?.schedule_change_request_id;

    let requestId: number | null = null;
    if (typeof rawRequestId === "number" && Number.isFinite(rawRequestId)) {
      requestId = rawRequestId;
    } else if (typeof rawRequestId === "string") {
      const parsed = Number.parseInt(rawRequestId, 10);
      if (Number.isFinite(parsed)) {
        requestId = parsed;
      }
    }

    const title = notification.title.toLowerCase();
    const message = notification.message.toLowerCase();
    const type = notification.type.toLowerCase();

    const isScheduleChangeNotification =
      type.includes("schedule_change")
      || title.includes("schedule change")
      || message.includes("schedule change");

    if (!isScheduleChangeNotification && requestId === null) {
      return null;
    }

    return requestId !== null
      ? `${basePath}?request_id=${requestId}`
      : basePath;
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      void handleMarkRead(notification.id);
    }

    const targetPath = getScheduleChangeRequestTarget(notification);
    closeDropdown();

    if (targetPath) {
      router.push(targetPath);
    }
  };

  // Notification type → icon color
  const getIconBg = (type: string) => {
    if (type.includes("assigned")) return "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400";
    if (type.includes("updated") || type.includes("changed")) return "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400";
    if (type.includes("removed") || type.includes("cancelled")) return "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400";
    return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  };

  return (
    <div className="relative">
      <button
        className={`relative dropdown-toggle flex items-center justify-center transition-colors border rounded-full h-11 w-11 ${
          isOpen 
            ? "text-brand-600 bg-brand-50 border-brand-200 dark:bg-brand-500/20 dark:border-brand-500/50 dark:text-brand-400" 
            : "text-gray-500 bg-white border-gray-200 hover:text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        }`}
        onClick={handleClick}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {/* Bell icon - filled when open, outline when closed */}
        {isOpen ? (
          <svg
            className="fill-current"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Filled bell */}
            <path
              d="M10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248Z"
              fill="currentColor"
            />
            <path
              d="M8.75004 16.9585C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004Z"
              fill="currentColor"
            />
          </svg>
        ) : (
          <svg
            className="fill-current"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outline bell */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
      {isOpen && (
        <button
          type="button"
          aria-label="Close notifications panel"
          onClick={closeDropdown}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] sm:hidden"
        />
      )}
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="fixed! sm:absolute! right-2! sm:right-0! left-2! sm:left-auto! top-16! sm:top-auto! mt-0 sm:mt-[17px] flex h-[calc(100vh-5rem)] sm:h-[480px] w-auto sm:w-[361px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">
                {unreadCount}
              </span>
            )}
          </h5>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <svg
                className="fill-current"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <svg
                className="mb-3"
                width="40"
                height="40"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-sm">No notifications yet</span>
            </li>
          ) : (
            notifications.map((notification) => (
              <li key={notification.id}>
                <DropdownItem
                  onItemClick={() => {
                    void handleNotificationClick(notification);
                  }}
                  className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                    !notification.is_read
                      ? "bg-brand-50/50 dark:bg-brand-500/5"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getIconBg(
                      notification.type
                    )}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z" fill="currentColor" />
                    </svg>
                  </span>

                  <span className="block min-w-0 flex-1">
                    <span className="mb-0.5 block text-theme-sm font-medium text-gray-800 dark:text-white/90 truncate">
                      {notification.title}
                    </span>
                    <span className="mb-1.5 block text-theme-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="flex items-center gap-2 text-gray-400 text-theme-xs dark:text-gray-500">
                      <span>{notification.time_ago}</span>
                      {!notification.is_read && (
                        <>
                          <span className="w-1 h-1 bg-brand-500 rounded-full"></span>
                          <span className="text-brand-500 font-medium">New</span>
                        </>
                      )}
                    </span>
                  </span>
                </DropdownItem>
              </li>
            ))
          )}
        </ul>
      </Dropdown>
    </div>
  );
}
