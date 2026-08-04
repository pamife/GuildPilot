"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastContainer";
import { getSocket } from "@/lib/socket";
import {
  ClipboardList,
  LayoutDashboard,
  FileText,
  HelpCircle,
  Shield,
  Clock,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Edit,
  Send,
  Lock,
  Unlock,
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  Eye,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Download,
  Calendar,
  Hash,
  FolderTree,
  Filter,
  Check,
  Users,
  Award,
  Layers,
  FileCode,
  Tag,
  Share2,
} from "lucide-react";

type SubPage = "dashboard" | "forms" | "applications" | "questions" | "roles" | "review-queue" | "statistics" | "settings";

interface ApplicationsViewProps {
  selectedGuildId: string | null;
  channels: any[];
  roles: any[];
}

export function ApplicationsView({ selectedGuildId, channels, roles }: ApplicationsViewProps) {
  const { showToast } = useToast();
  const [activeSubPage, setActiveSubPage] = useState<SubPage>("dashboard");

  // Data states
  const [stats, setStats] = useState<any>({
    totalForms: 0,
    totalApps: 0,
    activeApps: 0,
    pendingReviews: 0,
    accepted: 0,
    denied: 0,
    waitlisted: 0,
    closed: 0,
    appsToday: 0,
    avgReviewTimeMinutes: 0,
    acceptanceRate: 0,
    denialRate: 0,
    topReviewers: [],
    daysTrend: [],
    recentActivity: [],
  });

  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [appSettings, setAppSettings] = useState<any>({
    defaultReviewerRoles: [],
    defaultCategoryId: "",
    archiveCategoryId: "",
    logChannelId: "",
    transcriptStorage: "local",
    defaultCooldownHours: 24,
    maxAppsPerUser: 1,
    autoCloseHours: 0,
    autoArchive: false,
    timezone: "UTC",
  });

  // Filter & Search states
  const [loading, setLoading] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState("ALL");
  const [appFormFilter, setAppFormFilter] = useState("ALL");

  // Form Modal & Editor states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [formModalTab, setFormModalTab] = useState<"general" | "embed" | "roles" | "restrictions">("general");

  const [formPayload, setFormPayload] = useState<any>({
    name: "Staff Application",
    description: "Apply to join our server staff team.",
    category: "Staff",
    embedTitle: "📝 Staff Application Form",
    embedDescription: "Click the button below to submit your application for the staff team!",
    embedColor: "#5865F2",
    buttonText: "Apply Now",
    buttonEmoji: "📝",
    buttonColor: "Primary",
    targetChannelId: "",
    categoryId: "",
    reviewerRoles: [],
    applicantRoles: [],
    acceptedRoles: [],
    deniedRoles: [],
    cooldownHours: 24,
    maxActiveApps: 1,
    isOpen: true,
  });

  // Question Modal & Editor states
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [questionPayload, setQuestionPayload] = useState<any>({
    label: "",
    type: "SHORT_TEXT",
    placeholder: "",
    required: true,
    options: "",
    minLength: "",
    maxLength: "",
    helpText: "",
  });

  // Note & Decision Modal states
  const [noteText, setNoteText] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [pendingDecisionAction, setPendingDecisionAction] = useState<string | null>(null);

  // Fetch Stats & Core Data
  const fetchData = useCallback(async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const [statsRes, formsRes, appsRes, settingsRes] = await Promise.all([
        api.get(`/guilds/${selectedGuildId}/applications/stats`).catch(() => ({ data: {} })),
        api.get(`/guilds/${selectedGuildId}/applications/forms`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/applications/apps`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/applications/settings`).catch(() => ({ data: {} })),
      ]);

      setStats(statsRes.data || {});
      setForms(formsRes.data || []);
      setApplications(appsRes.data || []);
      setAppSettings(settingsRes.data || {});

      if (formsRes.data && formsRes.data.length > 0 && !selectedFormId) {
        setSelectedFormId(formsRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load applications data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, selectedFormId]);

  // Fetch Questions for Selected Form
  const fetchQuestions = useCallback(async () => {
    if (!selectedGuildId || !selectedFormId) return;
    try {
      const res = await api.get(`/guilds/${selectedGuildId}/applications/forms/${selectedFormId}/questions`);
      setQuestions(res.data || []);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    }
  }, [selectedGuildId, selectedFormId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedFormId) fetchQuestions();
  }, [selectedFormId, fetchQuestions]);

  // Socket.IO Listeners
  useEffect(() => {
    const socket = getSocket();

    const handleUpdate = () => {
      fetchData();
      if (selectedFormId) fetchQuestions();
    };

    socket.on("applicationSubmitted", handleUpdate);
    socket.on("applicationUpdated", handleUpdate);

    return () => {
      socket.off("applicationSubmitted", handleUpdate);
      socket.off("applicationUpdated", handleUpdate);
    };
  }, [fetchData, fetchQuestions, selectedFormId]);

  // Form Handlers
  const handleOpenFormModal = (form?: any) => {
    if (form) {
      setEditingForm(form);
      setFormPayload({
        name: form.name,
        description: form.description || "",
        category: form.category || "General",
        embedTitle: form.embedTitle || "",
        embedDescription: form.embedDescription || "",
        embedColor: form.embedColor || "#5865F2",
        buttonText: form.buttonText || "Apply Now",
        buttonEmoji: form.buttonEmoji || "📝",
        buttonColor: form.buttonColor || "Primary",
        targetChannelId: form.targetChannelId || "",
        categoryId: form.categoryId || "",
        reviewerRoles: JSON.parse(form.reviewerRoles || "[]"),
        applicantRoles: JSON.parse(form.applicantRoles || "[]"),
        acceptedRoles: JSON.parse(form.acceptedRoles || "[]"),
        deniedRoles: JSON.parse(form.deniedRoles || "[]"),
        cooldownHours: form.cooldownHours || 24,
        maxActiveApps: form.maxActiveApps || 1,
        isOpen: form.isOpen !== undefined ? form.isOpen : true,
      });
    } else {
      setEditingForm(null);
      setFormPayload({
        name: "New Application Form",
        description: "",
        category: "General",
        embedTitle: "📝 Application Form",
        embedDescription: "Click the button below to submit your application.",
        embedColor: "#5865F2",
        buttonText: "Apply Now",
        buttonEmoji: "📝",
        buttonColor: "Primary",
        targetChannelId: "",
        categoryId: "",
        reviewerRoles: [],
        applicantRoles: [],
        acceptedRoles: [],
        deniedRoles: [],
        cooldownHours: 24,
        maxActiveApps: 1,
        isOpen: true,
      });
    }
    setFormModalTab("general");
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async () => {
    if (!selectedGuildId) return;
    try {
      if (editingForm) {
        await api.patch(`/guilds/${selectedGuildId}/applications/forms/${editingForm.id}`, formPayload);
        showToast("Application Form updated successfully!", "success");
      } else {
        const res = await api.post(`/guilds/${selectedGuildId}/applications/forms`, formPayload);
        setSelectedFormId(res.data.id);
        showToast("Application Form created!", "success");
      }
      setIsFormModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save form", "error");
    }
  };

  const handleDeleteForm = async (formId: string) => {
    if (!selectedGuildId || !confirm("Are you sure you want to delete this application form?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/applications/forms/${formId}`);
      showToast("Form deleted", "success");
      if (selectedFormId === formId) setSelectedFormId(null);
      fetchData();
    } catch (err: any) {
      showToast("Failed to delete form", "error");
    }
  };

  const handleDeployForm = async (formId: string) => {
    if (!selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/applications/forms/${formId}/deploy`);
      showToast("Form Embed deployed to Discord channel!", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to deploy form embed", "error");
    }
  };

  // Question Builder Handlers
  const handleOpenQuestionModal = (q?: any) => {
    if (q) {
      setEditingQuestion(q);
      setQuestionPayload({
        label: q.label,
        type: q.type,
        placeholder: q.placeholder || "",
        required: q.required,
        options: Array.isArray(JSON.parse(q.options || "[]"))
          ? JSON.parse(q.options || "[]").join("\n")
          : "",
        minLength: q.minLength || "",
        maxLength: q.maxLength || "",
        helpText: q.helpText || "",
      });
    } else {
      setEditingQuestion(null);
      setQuestionPayload({
        label: "",
        type: "SHORT_TEXT",
        placeholder: "",
        required: true,
        options: "",
        minLength: "",
        maxLength: "",
        helpText: "",
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!selectedGuildId || !selectedFormId) return;
    try {
      const optionsArray = questionPayload.options
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const payload = {
        ...questionPayload,
        options: optionsArray,
      };

      if (editingQuestion) {
        await api.patch(`/guilds/${selectedGuildId}/applications/questions/${editingQuestion.id}`, payload);
        showToast("Question updated", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/applications/forms/${selectedFormId}/questions`, payload);
        showToast("Question added", "success");
      }
      setIsQuestionModalOpen(false);
      fetchQuestions();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save question", "error");
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedGuildId || !confirm("Delete this question?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/applications/questions/${qId}`);
      showToast("Question deleted", "success");
      fetchQuestions();
    } catch (err: any) {
      showToast("Failed to delete question", "error");
    }
  };

  const handleDuplicateQuestion = async (qId: string) => {
    if (!selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/applications/questions/${qId}/duplicate`);
      showToast("Question duplicated", "success");
      fetchQuestions();
    } catch (err) {
      showToast("Failed to duplicate question", "error");
    }
  };

  const handleMoveQuestion = async (index: number, direction: "up" | "down") => {
    if (!questions || !selectedFormId) return;
    const newQuestions = [...questions];
    const targetIdx = direction === "up" ? index - 1 : index + 1;

    if (targetIdx < 0 || targetIdx >= newQuestions.length) return;

    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;

    setQuestions(newQuestions);

    const questionIds = newQuestions.map((q) => q.id);
    try {
      await api.put(`/guilds/${selectedGuildId}/applications/forms/${selectedFormId}/questions/reorder`, {
        questionIds,
      });
    } catch (e) {
      fetchQuestions();
    }
  };

  // Application Review & Decision Handlers
  const handlePerformAction = async (appId: string, action: string, reason?: string) => {
    if (!selectedGuildId) return;
    try {
      const res = await api.post(`/guilds/${selectedGuildId}/applications/apps/${appId}/action`, {
        action,
        reason,
      });
      showToast(`Action '${action}' executed successfully!`, "success");
      if (selectedApp?.id === appId) {
        setSelectedApp(res.data.application);
      }
      setIsDecisionModalOpen(false);
      setDecisionReason("");
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to execute decision", "error");
    }
  };

  const handleAddNote = async () => {
    if (!selectedGuildId || !selectedApp || !noteText.trim()) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/applications/apps/${selectedApp.id}/notes`, {
        content: noteText.trim(),
      });
      showToast("Reviewer note added!", "success");
      setNoteText("");
      const updated = await api.get(`/guilds/${selectedGuildId}/applications/apps/${selectedApp.id}`);
      setSelectedApp(updated.data);
    } catch (err: any) {
      showToast("Failed to add note", "error");
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedGuildId) return;
    try {
      await api.patch(`/guilds/${selectedGuildId}/applications/settings`, appSettings);
      showToast("Application settings updated!", "success");
      fetchData();
    } catch (err: any) {
      showToast("Failed to update settings", "error");
    }
  };

  // Filtered Applications List
  const filteredApps = applications.filter((app) => {
    if (appStatusFilter !== "ALL" && app.status !== appStatusFilter) return false;
    if (appFormFilter !== "ALL" && app.formId !== appFormFilter) return false;
    if (appSearch.trim()) {
      const q = appSearch.toLowerCase();
      const matchTag = app.userTag.toLowerCase().includes(q);
      const matchId = app.userId.includes(q);
      const matchNum = String(app.appNumber).includes(q);
      const matchForm = app.form?.name.toLowerCase().includes(q);
      return matchTag || matchId || matchNum || matchForm;
    }
    return true;
  });

  const selectedForm = forms.find((f) => f.id === selectedFormId);

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#313338] text-zinc-100 overflow-hidden select-none">
      {/* Top Navbar Header */}
      <header className="h-16 bg-[#2b2d31] border-b border-[#1e1f22] px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-discord-brand/20 border border-discord-brand/40 flex items-center justify-center text-discord-brand shadow-inner">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Applications Workflow Engine
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-discord-brand/20 text-discord-brand font-semibold border border-discord-brand/30">
                v2.0 Native
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Manage custom application forms, reviewer queues, auto roles & transcripts
            </p>
          </div>
        </div>

        {/* Sub-Pages Navigation Bar */}
        <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "forms", label: "Forms", icon: FileText },
            { id: "applications", label: "Applications", icon: Layers },
            { id: "questions", label: "Questions", icon: HelpCircle },
            { id: "roles", label: "Roles", icon: Shield },
            { id: "review-queue", label: "Review Queue", icon: UserCheck },
            { id: "statistics", label: "Statistics", icon: BarChart3 },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubPage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubPage(tab.id as SubPage)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-discord-brand text-white shadow-md font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-[#2b2d31]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ========================================== */}
        {/* 1. DASHBOARD SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "dashboard" && (
          <div className="space-y-6">
            {/* Overview KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-discord-brand/50 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Forms</p>
                    <h3 className="text-3xl font-extrabold text-white mt-1">{stats.totalForms || 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Unlimited form creation</span>
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Applications</p>
                    <h3 className="text-3xl font-extrabold text-white mt-1">{stats.activeApps || 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{stats.pendingReviews || 0} pending review</span>
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Accepted</p>
                    <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">{stats.accepted || 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-zinc-400">
                  <span className="font-bold text-emerald-400">{stats.acceptanceRate || 0}%</span> acceptance rate
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Denied</p>
                    <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{stats.denied || 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <XCircle className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-zinc-400">
                  <span className="font-bold text-rose-400">{stats.denialRate || 0}%</span> denial rate
                </div>
              </div>
            </div>

            {/* Sub-Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Avg. Review Time</p>
                  <p className="text-xl font-bold text-white mt-0.5">{stats.avgReviewTimeMinutes || 0} mins</p>
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Applications Today</p>
                  <p className="text-xl font-bold text-white mt-0.5">{stats.appsToday || 0} submissions</p>
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Reviewers</p>
                  <p className="text-xl font-bold text-white mt-0.5">{stats.topReviewers?.length || 0} staff active</p>
                </div>
              </div>
            </div>

            {/* Recent Activity Stream */}
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#35373c] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-discord-brand" />
                  Recent Activity Log
                </h3>
                <button
                  onClick={fetchData}
                  className="p-1.5 rounded-lg bg-[#1e1f22] text-zinc-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {stats.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#1e1f22] border border-[#35373c] text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-zinc-400 text-[11px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-bold text-discord-brand px-2 py-0.5 rounded bg-discord-brand/10 border border-discord-brand/20">
                          {log.action}
                        </span>
                        <span className="text-zinc-300">
                          <strong className="text-white">{log.executorTag}</strong> {log.details}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-400 text-sm">
                  No activity recorded yet. Submit your first application form!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 2. FORMS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "forms" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Application Forms</h2>
                <p className="text-xs text-zinc-400">Configure unlimited application embeds & forms</p>
              </div>
              <button
                onClick={() => handleOpenFormModal()}
                className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create Form
              </button>
            </div>

            {/* Forms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map((f) => (
                <div
                  key={f.id}
                  className={`bg-[#2b2d31] border rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all ${
                    selectedFormId === f.id ? "border-discord-brand ring-2 ring-discord-brand/20" : "border-[#35373c]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-discord-brand px-2.5 py-1 rounded-full bg-discord-brand/10 border border-discord-brand/30">
                        {f.category || "General"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          f.isOpen ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        }`}
                      >
                        {f.isOpen ? "OPEN" : "CLOSED"}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white">{f.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{f.description || "No description provided."}</p>

                    <div className="mt-4 pt-3 border-t border-[#35373c] text-xs text-zinc-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Questions:</span>
                        <span className="font-bold text-white">{f.questions?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cooldown:</span>
                        <span className="font-bold text-white">{f.cooldownHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Active:</span>
                        <span className="font-bold text-white">{f.maxActiveApps}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2 pt-4 border-t border-[#35373c]">
                    <button
                      onClick={() => setSelectedFormId(f.id)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        selectedFormId === f.id
                          ? "bg-discord-brand text-white border-discord-brand"
                          : "bg-[#1e1f22] text-zinc-300 border-[#35373c] hover:border-discord-brand"
                      }`}
                    >
                      {selectedFormId === f.id ? "Selected Form" : "Select Form"}
                    </button>
                    <button
                      onClick={() => handleDeployForm(f.id)}
                      title="Deploy Embed to Discord Channel"
                      className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenFormModal(f)}
                      title="Edit Form"
                      className="p-2 rounded-xl bg-[#1e1f22] border border-[#35373c] text-zinc-300 hover:text-white transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteForm(f.id)}
                      title="Delete Form"
                      className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 3. APPLICATIONS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "applications" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#2b2d31] p-4 rounded-2xl border border-[#35373c]">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search applications by User, ID, App # or Form..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-discord-brand"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-400" />
                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value)}
                  className="bg-[#1e1f22] border border-[#35373c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-discord-brand"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="CLAIMED">CLAIMED</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="DENIED">DENIED</option>
                  <option value="WAITLISTED">WAITLISTED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
            </div>

            {/* Applications Table */}
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1e1f22] text-zinc-400 font-bold uppercase border-b border-[#35373c]">
                    <th className="py-3 px-4">App #</th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Form</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Claimed By</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#35373c]">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400">
                        No applications matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((a) => (
                      <tr key={a.id} className="hover:bg-[#35373c]/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-discord-brand">#{a.appNumber}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {a.userAvatar ? (
                              <img src={a.userAvatar} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-discord-brand/20 flex items-center justify-center font-bold text-discord-brand text-[10px]">
                                {a.userTag.substring(0, 1)}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-white">{a.userTag}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">{a.userId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-300">{a.form?.name || "General Form"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              a.status === "ACCEPTED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : a.status === "DENIED"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                : a.status === "CLAIMED"
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                                : a.status === "WAITLISTED"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-300 font-medium">{a.claimedByTag || "Unclaimed"}</td>
                        <td className="py-3 px-4 text-zinc-400">{new Date(a.submittedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedApp(a)}
                            className="px-3 py-1.5 bg-[#1e1f22] hover:bg-discord-brand text-zinc-200 hover:text-white rounded-lg font-bold transition-all text-xs"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 4. QUESTIONS BUILDER SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "questions" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-[#2b2d31] p-4 rounded-2xl border border-[#35373c]">
              <div>
                <h2 className="text-xl font-bold text-white">Question Builder</h2>
                <p className="text-xs text-zinc-400">
                  Target Form: <span className="font-bold text-discord-brand">{selectedForm?.name || "Select a form"}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedFormId || ""}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="bg-[#1e1f22] border border-[#35373c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-discord-brand"
                >
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleOpenQuestionModal()}
                  disabled={!selectedFormId}
                  className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add Question
                </button>
              </div>
            </div>

            {/* Questions Ordering List */}
            <div className="space-y-3">
              {questions.length === 0 ? (
                <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-8 text-center text-zinc-400 text-sm">
                  No questions added for this form yet. Click "Add Question" to build your intake form!
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-4 flex items-center justify-between shadow-md hover:border-discord-brand/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveQuestion(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded bg-[#1e1f22] hover:bg-[#35373c] text-zinc-400 disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(idx, "down")}
                          disabled={idx === questions.length - 1}
                          className="p-1 rounded bg-[#1e1f22] hover:bg-[#35373c] text-zinc-400 disabled:opacity-30"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-400 font-bold">Q{idx + 1}.</span>
                          <h4 className="font-bold text-white text-sm">{q.label}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-discord-brand/20 text-discord-brand border border-discord-brand/30">
                            {q.type}
                          </span>
                          {q.required && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              Required
                            </span>
                          )}
                        </div>
                        {q.placeholder && <p className="text-xs text-zinc-400 mt-1">Placeholder: "{q.placeholder}"</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDuplicateQuestion(q.id)}
                        title="Duplicate Question"
                        className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300 hover:text-white transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenQuestionModal(q)}
                        title="Edit Question"
                        className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300 hover:text-white transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Delete Question"
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 5. ROLES SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "roles" && (
          <div className="space-y-6">
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-discord-brand" />
                Automatic Role Management
              </h3>
              <p className="text-xs text-zinc-400">
                Configure which roles are automatically granted or removed when an applicant is accepted or denied.
              </p>

              {forms.map((f) => (
                <div key={f.id} className="p-4 bg-[#1e1f22] rounded-xl border border-[#35373c] space-y-3">
                  <h4 className="font-bold text-white text-sm">{f.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-emerald-400 block mb-1">
                        Accepted Role(s) Granted:
                      </label>
                      <select
                        multiple
                        value={JSON.parse(f.acceptedRoles || "[]")}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                          api.patch(`/guilds/${selectedGuildId}/applications/forms/${f.id}`, {
                            acceptedRoles: selected,
                          });
                          fetchData();
                        }}
                        className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl p-2 text-xs text-white h-24"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            @{r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-rose-400 block mb-1">
                        Denied Role(s) Granted:
                      </label>
                      <select
                        multiple
                        value={JSON.parse(f.deniedRoles || "[]")}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                          api.patch(`/guilds/${selectedGuildId}/applications/forms/${f.id}`, {
                            deniedRoles: selected,
                          });
                          fetchData();
                        }}
                        className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl p-2 text-xs text-white h-24"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            @{r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 6. REVIEW QUEUE SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "review-queue" && (
          <div className="space-y-6">
            <div className="bg-[#2b2d31] p-4 rounded-2xl border border-[#35373c] flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Reviewer Workspace Queue</h2>
                <p className="text-xs text-zinc-400">Process pending applications swiftly</p>
              </div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold border border-amber-500/30">
                {applications.filter((a) => ["PENDING", "UNDER_REVIEW", "CLAIMED"].includes(a.status)).length} Pending Review
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {applications
                .filter((a) => ["PENDING", "UNDER_REVIEW", "CLAIMED"].includes(a.status))
                .map((a) => (
                  <div key={a.id} className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#35373c] pb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-discord-brand">App #{a.appNumber}</span>
                        <h4 className="font-bold text-white text-base">{a.userTag}</h4>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                        {a.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-zinc-300">
                      {a.answers?.slice(0, 3).map((ans: any, idx: number) => (
                        <div key={idx} className="bg-[#1e1f22] p-2.5 rounded-lg border border-[#35373c]">
                          <p className="font-bold text-discord-brand text-[11px]">{ans.questionLabel}</p>
                          <p className="text-zinc-200 mt-1 line-clamp-2">{ans.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#35373c]">
                      <button
                        onClick={() => handlePerformAction(a.id, "claim")}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        📌 Claim
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApp(a);
                          setPendingDecisionAction("accept");
                          setIsDecisionModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        ✅ Accept
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApp(a);
                          setPendingDecisionAction("deny");
                          setIsDecisionModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        ❌ Deny
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 7. STATISTICS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "statistics" && (
          <div className="space-y-6">
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-discord-brand" />
                Applications Analytics & Leaderboards
              </h3>

              {/* 7-Day Submissions Trend */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#35373c] space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-zinc-400">
                  Submissions Volume (Last 7 Days)
                </h4>
                <div className="flex items-end justify-between h-32 pt-6 px-4">
                  {stats.daysTrend?.map((d: any, idx: number) => (
                    <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                      <div
                        style={{ height: `${Math.max(d.count * 15, 8)}px` }}
                        className="w-8 bg-discord-brand rounded-t-lg transition-all hover:bg-discord-brandHover"
                      />
                      <span className="text-[10px] font-mono text-zinc-400">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Reviewers Leaderboard */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#35373c] space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-zinc-400">
                  🏆 Top Staff Reviewers Leaderboard
                </h4>
                <div className="space-y-2">
                  {stats.topReviewers?.map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#2b2d31] text-xs">
                      <span className="font-bold text-white">
                        #{idx + 1} {r.tag}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-discord-brand/20 text-discord-brand font-bold border border-discord-brand/30">
                        {r.count} applications processed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 8. SETTINGS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "settings" && (
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-6 max-w-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-discord-brand" />
              Global Applications Module Settings
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Default Reviewer Roles:</label>
                <select
                  multiple
                  value={appSettings.defaultReviewerRoles}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setAppSettings({ ...appSettings, defaultReviewerRoles: selected });
                  }}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2 text-white h-24"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      @{r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Default Application Category Channel:</label>
                <select
                  value={appSettings.defaultCategoryId || ""}
                  onChange={(e) => setAppSettings({ ...appSettings, defaultCategoryId: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                >
                  <option value="">None (Use target channel mode)</option>
                  {channels
                    .filter((c) => c.type === 4)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        📂 {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Default Cooldown (Hours):</label>
                <input
                  type="number"
                  value={appSettings.defaultCooldownHours}
                  onChange={(e) => setAppSettings({ ...appSettings, defaultCooldownHours: Number(e.target.value) })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-4 border-t border-[#35373c] flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingForm ? "Edit Application Form" : "Create Application Form"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Form Name:</label>
                <input
                  type="text"
                  value={formPayload.name}
                  onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Target Channel for Embed Deployment:</label>
                <select
                  value={formPayload.channelId || ""}
                  onChange={(e) => setFormPayload({ ...formPayload, channelId: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                >
                  <option value="">Select Channel...</option>
                  {channels
                    .filter((c) => c.type === 0)
                    .map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Button Label:</label>
                <input
                  type="text"
                  value={formPayload.buttonText}
                  onChange={(e) => setFormPayload({ ...formPayload, buttonText: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 bg-[#1e1f22] hover:bg-[#35373c] text-zinc-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveForm}
                className="px-5 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs"
              >
                Save Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingQuestion ? "Edit Question" : "Add Intake Question"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Question Label:</label>
                <input
                  type="text"
                  placeholder="e.g. Why do you want to join our staff team?"
                  value={questionPayload.label}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, label: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Question Type:</label>
                <select
                  value={questionPayload.type}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, type: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-semibold"
                >
                  <option value="SHORT_TEXT">Short Text (Single line)</option>
                  <option value="PARAGRAPH">Paragraph (Multi-line text)</option>
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="DROPDOWN">Dropdown Menu</option>
                  <option value="YES_NO">Yes / No</option>
                  <option value="NUMBER">Number Input</option>
                  <option value="DATE">Date Input</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Placeholder (Optional):</label>
                <input
                  type="text"
                  value={questionPayload.placeholder}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, placeholder: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="req"
                  checked={questionPayload.required}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, required: e.target.checked })}
                  className="w-4 h-4 rounded text-discord-brand focus:ring-0"
                />
                <label htmlFor="req" className="font-bold text-white cursor-pointer">
                  Required Question
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
              <button
                onClick={() => setIsQuestionModalOpen(false)}
                className="px-4 py-2 bg-[#1e1f22] hover:bg-[#35373c] text-zinc-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-5 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs"
              >
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision / Reason Modal */}
      {isDecisionModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Confirm Decision: {pendingDecisionAction?.toUpperCase()}
            </h3>

            <div className="space-y-3 text-xs">
              <p className="text-zinc-300">
                Are you sure you want to mark Application <strong>#{selectedApp.appNumber}</strong> ({selectedApp.userTag}) as{" "}
                <span className="font-bold text-discord-brand">{pendingDecisionAction?.toUpperCase()}</span>?
              </p>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Decision Reason / Notes (Optional):</label>
                <textarea
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Provide a reason for the applicant..."
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
              <button
                onClick={() => setIsDecisionModalOpen(false)}
                className="px-4 py-2 bg-[#1e1f22] hover:bg-[#35373c] text-zinc-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePerformAction(selectedApp.id, pendingDecisionAction!, decisionReason)}
                className="px-5 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Drawer */}
      {selectedApp && !isDecisionModalOpen && (
        <div className="fixed inset-y-0 right-0 w-[450px] bg-[#2b2d31] border-l border-[#35373c] shadow-2xl p-6 overflow-y-auto space-y-6 z-40 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-[#35373c] pb-4">
            <div>
              <span className="font-mono text-xs font-bold text-discord-brand">App #{selectedApp.appNumber}</span>
              <h3 className="text-lg font-bold text-white">{selectedApp.userTag}</h3>
            </div>
            <button
              onClick={() => setSelectedApp(null)}
              className="p-1 rounded-lg bg-[#1e1f22] text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Submitted Answers */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-zinc-400">
              Submitted Answers
            </h4>
            {selectedApp.answers?.map((ans: any, idx: number) => (
              <div key={idx} className="bg-[#1e1f22] p-3 rounded-xl border border-[#35373c]">
                <p className="font-bold text-discord-brand">{ans.questionLabel}</p>
                <p className="text-zinc-200 mt-1">{ans.value}</p>
              </div>
            ))}
          </div>

          {/* Notes Section */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-zinc-400">Reviewer Notes</h4>
            <div className="space-y-2">
              {selectedApp.notes?.map((n: any) => (
                <div key={n.id} className="bg-[#1e1f22] p-2.5 rounded-lg border-l-2 border-purple-500">
                  <p className="font-bold text-purple-400">{n.authorTag}</p>
                  <p className="text-zinc-300 mt-0.5">{n.content}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Add reviewer note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 bg-[#1e1f22] border border-[#35373c] rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <button
                onClick={handleAddNote}
                className="px-3 py-1.5 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
