"use client";

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { getStoredMeetings, deleteMeeting, fetchAndHydrateMeetingsFromSupabase } from '@/lib/store/localStore';
import { Meeting } from '@/types';
import { Video, Search, Mic, ArrowRight, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

export default function MeetingsListPage() {
  const { activeOrg } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const refreshMeetings = () => {
    setMeetings(getStoredMeetings());
  };

  useEffect(() => {
    refreshMeetings();
    if (activeOrg?.id) {
      fetchAndHydrateMeetingsFromSupabase(activeOrg.id).then((hydrated) => {
        setMeetings(hydrated);
      });
    }
  }, [activeOrg?.id]);

  const handleDeleteMeeting = (e: React.MouseEvent, mtgId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      deleteMeeting(mtgId);
      refreshMeetings();
    }
  };

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3 leading-tight">
              <Video className="w-7 h-7 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>Meetings Directory</span>
            </h1>
          </div>

          <Link
            href="/new-meeting"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-hero transition-all active:scale-95"
          >
            <Mic className="w-4 h-4 flex-shrink-0" />
            <span>Process New Audio</span>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="card-white p-4 mb-4 flex items-center gap-3">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search meetings by title, summary, or action items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-transparent focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-500"
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-6">
          Click any meeting to see its full summary, health score, and action items.
        </p>

        {/* Meetings List Grid */}
        <div className="space-y-4">
          {filteredMeetings.map((mtg) => (
            <div key={mtg.id} className="card-white p-6 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center justify-center text-sm uppercase">
                    {mtg.title.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">{mtg.title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                      {mtg.date} • {mtg.duration} • {mtg.speakerSegments?.length || 0} speaker turns • {mtg.actionItems?.length || 0} action items
                      {mtg.originalLanguage && ` • (${mtg.originalLanguage} translated)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Stage Status Badge */}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                    mtg.status === 'uploaded'
                      ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : mtg.status === 'draft'
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {mtg.status === 'uploaded' ? 'Uploaded' : mtg.status === 'draft' ? 'Draft' : 'Completed'}
                  </span>

                  <PillBadge priority={mtg.sentiment === 'positive' ? 'low' : 'high'} label={mtg.sentiment.toUpperCase()} size="sm" />
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    Health {mtg.healthScore?.score || 85}/100
                  </span>
                  
                  <button
                    onClick={(e) => handleDeleteMeeting(e, mtg.id, mtg.title)}
                    title="Delete meeting"
                    className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/meetings/${mtg.id}`}
                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                {mtg.summary}
              </p>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
