"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  Mic, LayoutDashboard, CheckSquare, Video, Sun, Moon, Users, 
  Menu, X, LogOut, UserPlus, Plus, User 
} from 'lucide-react';
import { PillBadge } from '../ui/PillBadge';
import { UserAvatar } from '../ui/UserAvatar';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '../auth/AuthProvider';
import { InviteModal } from '../auth/InviteModal';
import { CreateOrgModal } from '../auth/CreateOrgModal';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, activeOrg, userOrgs, switchOrg, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/new-meeting', label: 'Live Recorder', icon: Mic },
    { href: '/tasks', label: 'Task Board', icon: CheckSquare },
    { href: '/meetings', label: 'All Meetings', icon: Video },
    { href: '/team', label: 'Team & Groups', icon: Users },
  ];

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const userInitial = (user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase();
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account User';

  return (
    <header className="sticky top-0 z-50 bg-[#F7F7F9]/85 dark:bg-[#0F0F12]/85 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800/80 px-4 lg:px-8 py-3 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Left Side: Brand Logo & Title */}
        <div className="flex items-center gap-3.5">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-h-[44px]">
            <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <Image
                src="/original_logo.png"
                alt="Echoes Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-zinc-900 dark:text-white">Echoes</span>
                <span className="hidden sm:inline-flex">
                  <PillBadge label="AI 2.0" variant="ai" size="sm" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-white dark:bg-[#1C1C21] px-2 py-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm transition-colors duration-300">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold min-h-[44px] transition-all ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400 dark:text-indigo-200' : 'text-zinc-500 dark:text-zinc-400'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Theme Toggle, CTA, and Far-Right Profile Circle Dropdown Trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Light/Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
            className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-300 shadow-sm flex items-center justify-center active:scale-95"
          >
            <div className="relative w-4 h-4 flex items-center justify-center transition-transform duration-300">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 rotate-0 scale-100 transition-all duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 rotate-0 scale-100 transition-all duration-300" />
              )}
            </div>
          </button>

          {/* New Meeting CTA */}
          <Link
            href="/new-meeting"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 min-h-[40px] sm:min-h-[44px] rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-hero hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Mic className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">+ New Meeting</span>
            <span className="sm:hidden">New</span>
          </Link>

          {/* PROFILE CIRCLE / SIGN IN TRIGGER */}
          {!user ? (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1C1C21] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-bold transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm"
              title="Sign in to your account"
            >
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>Sign In</span>
            </Link>
          ) : (
            <div className="relative flex items-center" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-label="Account and Workspace menu"
                title={`${userDisplayName} (${user.email})`}
                className="focus:outline-none rounded-full"
              >
                <UserAvatar
                  src={avatarUrl}
                  name={userDisplayName}
                  sizeClassName="w-9 h-9 sm:w-10 sm:h-10"
                  textSizeClassName="text-sm font-bold"
                />
              </button>

              {/* SINGLE UNIFIED FLOATING DROPDOWN ANCHORED DIRECTLY UNDER PROFILE CIRCLE */}
              {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                  
                  {/* SECTION 1 — Account Identity (top) */}
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                    <UserAvatar
                      src={avatarUrl}
                      name={userDisplayName}
                      sizeClassName="w-9 h-9"
                      textSizeClassName="text-xs font-bold"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {userDisplayName}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* DIVIDER 1 */}
                  <div className="my-2.5 border-t border-zinc-100 dark:border-zinc-800" />

                  {/* SECTION 2 — Workspaces */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2 py-1 mb-1">
                      <span>YOUR WORKSPACES</span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {userOrgs.map((org) => {
                        const isActive = activeOrg && org.id === activeOrg.id;
                        return (
                          <button
                            key={org.id}
                            onClick={() => {
                              switchOrg(org.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span className="truncate">{org.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DIVIDER 2 */}
                  <div className="my-2.5 border-t border-zinc-100 dark:border-zinc-800" />

                  {/* SECTION 3 — Workspace Actions */}
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsInviteModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-zinc-400" />
                      <span>+ Invite teammates</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsCreateOrgModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-400" />
                      <span>+ Create workspace</span>
                    </button>
                  </div>

                  {/* DIVIDER 3 */}
                  <div className="my-2.5 border-t border-zinc-100 dark:border-zinc-800" />

                  {/* SECTION 4 — Sign Out (bottom, visually separated) */}
                  <div>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="md:hidden w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-95"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Floating Mobile Drawer Panel Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 top-[60px] z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200" 
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="absolute top-full left-0 right-0 z-50 p-4 bg-white/95 dark:bg-[#1C1C21]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 shadow-2xl md:hidden animate-in slide-in-from-top-2 duration-200">
            <nav className="max-w-7xl mx-auto flex flex-col gap-1.5">
              {activeOrg && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/60 mb-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200">Workspace: {activeOrg.name}</span>
                </div>
              )}
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold min-h-[44px] transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsInviteModalOpen(true);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Invite teammates</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    signOut();
                  }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* Teammate Invite & Workspace Creation Modals */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      <CreateOrgModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
      />
    </header>
  );
};
