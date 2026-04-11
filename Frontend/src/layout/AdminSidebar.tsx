"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  GridIcon,
  ChevronDownIcon,
  HorizontaLDots,
  UserCircleIcon,
  TableIcon,
  CalenderIcon,
  PieChartIcon,
  PageIcon,
} from "../icons/index";
import { adminScheduleChangeRequestsApi } from "../lib/admin-api";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

type SubmenuState = {
  type: "main" | "others";
  index: number;
};

type SubmenuPreference = SubmenuState | "none" | null;

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/admin/dashboard",
  },
  {
    name: "User Management",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "All Users", path: "/admin/users" },
      { name: "Administrators", path: "/admin/users/administrators" },
      { name: "Department Heads", path: "/admin/users/department-heads" },
      { name: "Faculty Members", path: "/admin/users/faculty" },
      { name: "Create User", path: "/admin/users/create" },
    ],
  },
  {
    name: "Academic Management",
    icon: <PageIcon />,
    subItems: [
      { name: "Colleges", path: "/admin/colleges" },
      { name: "Departments", path: "/admin/departments" },
      { name: "Dept. Groups", path: "/admin/department-groups" },
      { name: "Rooms", path: "/admin/rooms" },
      { name: "Curricula", path: "/admin/curricula" },
      { name: "Subjects", path: "/admin/subjects" },
    ],
  },
  {
    name: "Scheduling",
    icon: <CalenderIcon />,
    subItems: [
      { name: "Academic Years", path: "/admin/academic-years" },
      { name: "Schedules", path: "/admin/schedules" },
      { name: "Schedule Change Requests", path: "/admin/schedule-change-requests" },
      { name: "Faculty Loading", path: "/admin/faculty-loading" },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    name: "History & Reports",
    icon: <PieChartIcon />,
    subItems: [
      { name: "History", path: "/admin/history" },
      { name: "Faculty Workload", path: "/admin/reports/faculty-workload" },
      { name: "Room Utilization", path: "/admin/reports/room-utilization" },
    ],
  },
];

const systemItems: NavItem[] = [
  {
    icon: <TableIcon />,
    name: "Activity Logs",
    path: "/admin/activity-logs",
  },
  {
    icon: <PageIcon />,
    name: "Settings",
    path: "/admin/settings",
  },
];

const AdminSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const [pendingScheduleChangeCount, setPendingScheduleChangeCount] = useState(0);

  const [openSubmenuPreference, setOpenSubmenuPreference] = useState<{
    pathname: string;
    value: SubmenuPreference;
  }>({
    pathname,
    value: null,
  });
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => pathname === path || pathname.startsWith(path + "/"),
    [pathname]
  );

  const activeSubmenu: SubmenuState | null = (() => {
    const menuGroups: Array<{ type: "main" | "others"; items: NavItem[] }> = [
      { type: "main", items: navItems },
      { type: "others", items: othersItems },
    ];

    for (const group of menuGroups) {
      const index = group.items.findIndex((item) =>
        item.subItems?.some((subItem) => isActive(subItem.path))
      );

      if (index !== -1) {
        return { type: group.type, index };
      }
    }

    return null;
  })();

  const openSubmenu: SubmenuState | null = (() => {
    const currentPreference =
      openSubmenuPreference.pathname === pathname
        ? openSubmenuPreference.value
        : null;

    if (currentPreference === "none") {
      return null;
    }

    if (currentPreference) {
      return currentPreference;
    }

    return activeSubmenu;
  })();

  const openSubmenuType = openSubmenu?.type ?? null;
  const openSubmenuIndex = openSubmenu?.index ?? null;

  useEffect(() => {
    let mounted = true;

    const loadPendingScheduleChangeCount = async () => {
      try {
        const pendingRequests = await adminScheduleChangeRequestsApi.list({
          status: "pending",
          admin_status: "pending",
          limit: 100,
        });

        if (!mounted) return;
        setPendingScheduleChangeCount(pendingRequests.length);
      } catch {
        if (!mounted) return;
        setPendingScheduleChangeCount(0);
      }
    };

    void loadPendingScheduleChangeCount();

    const intervalId = window.setInterval(() => {
      void loadPendingScheduleChangeCount();
    }, 60000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const renderMenuItems = (
    menuItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {menuItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => {
                  const pendingCount =
                    subItem.path === "/admin/schedule-change-requests"
                      ? pendingScheduleChangeCount
                      : 0;

                  return (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        } flex items-center justify-between gap-2`}
                      >
                        <span className="truncate">{subItem.name}</span>
                        {pendingCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                            {pendingCount > 99 ? "99+" : pendingCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  useEffect(() => {
    if (openSubmenuType !== null && openSubmenuIndex !== null) {
      const key = `${openSubmenuType}-${openSubmenuIndex}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenuType, openSubmenuIndex]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenuPreference((prev) => {
      const currentPreference = prev.pathname === pathname ? prev.value : null;

      if (
        currentPreference &&
        currentPreference !== "none" &&
        currentPreference.type === menuType &&
        currentPreference.index === index
      ) {
        return { pathname, value: "none" };
      }

      return { pathname, value: { type: menuType, index } };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center shrink-0">
            <Image
              src="/images/logo/norsu.png"
              alt="Negros Oriental State University seal"
              width={32}
              height={32}
              className="h-10 w-10 object-contain"
            />
          </div>
          {(isExpanded || isHovered || isMobileOpen) && (
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-white/90">NORSU</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scheduling System</p>
            </div>
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Analytics" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "System" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(systemItems, "others")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AdminSidebar;
