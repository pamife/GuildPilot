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
  Palette,
  Image as ImageIcon,
} from "lucide-react";

type SubPage = "dashboard" | "forms" | "applications" | "questions" | "roles" | "review-queue" | "statistics" | "settings";
type FormTab = "embed" | "welcome" | "channels" | "roles";

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
  const [formModalTab, setFormModalTab] = useState<FormTab>("embed");
  const [previewTab, setPreviewTab] = useState<"panel" | "welcome">("panel");

  const [formPayload, setFormPayload] = useState<any>({
    name: "Staff Application",
    description: "Apply to join our server staff team.",
    category: "Staff",
    displayType: "dropdown",
    embedTitle: "📝 Server Applications",
    embedDescription: "Select an application position from the dropdown menu below to submit your application.",
    embedColor: "#5865F2",
    thumbnail: "",
    image: "",
    footer: "GuildPilot Applications System",
    welcomeTitle: "👋 Application Submitted!",
    welcomeDescription: "Your application has been received. Reviewers will inspect your answers shortly.",
    welcomeColor: "#5865F2",
    welcomeThumbnail: "",
    welcomeImage: "",
    welcomeFooter: "GuildPilot Applications System",
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
        displayType: form.displayType || "dropdown",
        embedTitle: form.embedTitle || "",
        embedDescription: form.embedDescription || "",
        embedColor: form.embedColor || "#5865F2",
        thumbnail: form.thumbnail || "",
        image: form.image || "",
        footer: form.footer || "",
        welcomeTitle: form.welcomeTitle || "👋 Application Submitted!",
        welcomeDescription: form.welcomeDescription || "Your application has been received.",
        welcomeColor: form.welcomeColor || "#5865F2",
        welcomeThumbnail: form.welcomeThumbnail || "",
        welcomeImage: form.welcomeImage || "",
        welcomeFooter: form.welcomeFooter || "",
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
        displayType: "dropdown",
        embedTitle: "📝 Server Applications",
        embedDescription: "Select an application position from the dropdown menu below to submit your application.",
        embedColor: "#5865F2",
        thumbnail: "",
        image: "",
        footer: "GuildPilot Applications System",
        welcomeTitle: "👋 Application Submitted!",
        welcomeDescription: "Your application has been received.",
        welcomeColor: "#5865F2",
        welcomeThumbnail: "",
        welcomeImage: "",
        welcomeFooter: "GuildPilot Applications System",
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
    setFormModalTab("embed");
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async () => {
    if (!selectedGuildId) return;
    try {
      if (editingForm) {
        await api.patch(`/guilds/${selectedGuildId}/applications/forms/${editingForm.id}`, formPayload);
        showToast("Application Panel / Form updated!", "success");
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
      showToast("Form Panel deployed to Discord channel!", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to deploy application embed", "error");
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
                Ticket-Style Dropdown & Panels
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Manage application panels, dropdown menus, intake questions & auto roles
            </p>
          </div>
        </div>

        {/* Sub-Pages Navigation Bar */}
        <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "forms", label: "Panels & Forms", icon: FileText },
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
              </div>
            </div>

            {/* Activity Stream */}
            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#35373c] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-discord-brand" />
                  Recent Activity Stream
                </h3>
                <button onClick={fetchData} className="p-1.5 rounded-lg bg-[#1e1f22] text-zinc-400 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {stats.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-[#1e1f22] border border-[#35373c] text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-zinc-400 text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
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
                <div className="text-center py-8 text-zinc-400 text-sm">No activity recorded yet.</div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 2. PANELS & FORMS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "forms" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Application Panels & Forms</h2>
                <p className="text-xs text-zinc-400">Configure ticket-style Dropdown menus & buttons for applications</p>
              </div>
              <button
                onClick={() => handleOpenFormModal()}
                className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create Application Panel
              </button>
            </div>

            {/* Forms / Panels Grid */}
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-discord-brand px-2.5 py-1 rounded-full bg-discord-brand/10 border border-discord-brand/30 flex items-center gap-1">
                        {f.displayType === "dropdown" ? "🔽 Dropdown Select" : "🔘 Button"}
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
                        <span>Intake Questions:</span>
                        <span className="font-bold text-white">{f.questions?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cooldown:</span>
                        <span className="font-bold text-white">{f.cooldownHours}h</span>
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
                      title="Deploy Embed Panel to Discord Channel"
                      className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 font-bold text-xs"
                    >
                      <Send className="w-4 h-4" /> Deploy
                    </button>
                    <button
                      onClick={() => handleOpenFormModal(f)}
                      title="Edit Panel"
                      className="p-2 rounded-xl bg-[#1e1f22] border border-[#35373c] text-zinc-300 hover:text-white transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteForm(f.id)}
                      title="Delete Panel"
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
        {/* 3. APPLICATIONS LIST SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "applications" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#2b2d31] p-4 rounded-2xl border border-[#35373c]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-discord-brand"
                />
              </div>

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

            <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1e1f22] text-zinc-400 font-bold uppercase border-b border-[#35373c]">
                    <th className="py-3 px-4">App #</th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Form</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Claimed By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#35373c]">
                  {filteredApps.map((a) => (
                    <tr key={a.id} className="hover:bg-[#35373c]/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-discord-brand">#{a.appNumber}</td>
                      <td className="py-3 px-4 font-bold text-white">{a.userTag}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-300">{a.form?.name || "General Form"}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-discord-brand/20 text-discord-brand border border-discord-brand/30">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{a.claimedByTag || "Unclaimed"}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedApp(a)}
                          className="px-3 py-1.5 bg-[#1e1f22] hover:bg-discord-brand text-white rounded-lg font-bold transition-all text-xs"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
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

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleMoveQuestion(idx, "up")} disabled={idx === 0} className="p-1 rounded bg-[#1e1f22] text-zinc-400">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleMoveQuestion(idx, "down")} disabled={idx === questions.length - 1} className="p-1 rounded bg-[#1e1f22] text-zinc-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400 font-bold">Q{idx + 1}.</span>
                        <h4 className="font-bold text-white text-sm">{q.label}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-discord-brand/20 text-discord-brand">
                          {q.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDuplicateQuestion(q.id)} className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => handleOpenQuestionModal(q)} className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 5. ROLES SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "roles" && (
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Automatic Role Management</h3>
            <p className="text-xs text-zinc-400">Configure roles granted automatically upon application decision.</p>
          </div>
        )}

        {/* ========================================== */}
        {/* 6. REVIEW QUEUE SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "review-queue" && (
          <div className="space-y-6">
            <div className="bg-[#2b2d31] p-4 rounded-2xl border border-[#35373c]">
              <h2 className="text-xl font-bold text-white">Reviewer Queue</h2>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 7. STATISTICS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "statistics" && (
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Application Statistics</h3>
          </div>
        )}

        {/* ========================================== */}
        {/* 8. SETTINGS SUB-PAGE */}
        {/* ========================================== */}
        {activeSubPage === "settings" && (
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-6 max-w-2xl">
            <h3 className="text-lg font-bold text-white">Global Settings</h3>
          </div>
        )}
      </main>

      {/* Ticket-Style Panel & Form Editor Modal with Live Preview */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#35373c] bg-[#1e1f22] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-discord-brand" />
                {editingForm ? "Edit Application Panel" : "Create Application Panel"}
              </h3>
              <div className="flex items-center gap-2 bg-[#2b2d31] p-1 rounded-xl border border-[#35373c]">
                {[
                  { id: "embed", label: "Embed Panel", icon: Palette },
                  { id: "welcome", label: "Welcome Embed", icon: Sparkles },
                  { id: "channels", label: "Channels", icon: Hash },
                  { id: "roles", label: "Roles", icon: Shield },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFormModalTab(t.id as FormTab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      formModalTab === t.id ? "bg-discord-brand text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Content + Live Discord Embed Preview Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
              {/* Left Column: Form Editors */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs border-r border-[#35373c]">
                {formModalTab === "embed" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Panel Name:</label>
                      <input
                        type="text"
                        value={formPayload.name}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Display Mode (Discord Interface):</label>
                      <select
                        value={formPayload.displayType}
                        onChange={(e) => setFormPayload({ ...formPayload, displayType: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-bold"
                      >
                        <option value="dropdown">🔽 Dropdown Menu (StringSelectMenu)</option>
                        <option value="button">🔘 Button Click (ActionRow Button)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Embed Title:</label>
                      <input
                        type="text"
                        value={formPayload.embedTitle}
                        onChange={(e) => setFormPayload({ ...formPayload, embedTitle: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Embed Description:</label>
                      <textarea
                        rows={3}
                        value={formPayload.embedDescription}
                        onChange={(e) => setFormPayload({ ...formPayload, embedDescription: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Embed Color (Hex):</label>
                      <input
                        type="color"
                        value={formPayload.embedColor}
                        onChange={(e) => setFormPayload({ ...formPayload, embedColor: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl h-10 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {formModalTab === "welcome" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Welcome Embed Title:</label>
                      <input
                        type="text"
                        value={formPayload.welcomeTitle}
                        onChange={(e) => setFormPayload({ ...formPayload, welcomeTitle: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Welcome Embed Description:</label>
                      <textarea
                        rows={3}
                        value={formPayload.welcomeDescription}
                        onChange={(e) => setFormPayload({ ...formPayload, welcomeDescription: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>
                  </div>
                )}

                {formModalTab === "channels" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Target Panel Channel:</label>
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
                      <label className="font-bold text-zinc-300 block mb-1">Created Application Category:</label>
                      <select
                        value={formPayload.categoryId || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, categoryId: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      >
                        <option value="">Select Category...</option>
                        {channels
                          .filter((c) => c.type === 4)
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              📂 {cat.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Discord UI Embed Preview */}
              <div className="p-6 bg-[#313338] overflow-y-auto flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-discord-brand" /> Live Discord Preview
                    </span>

                    <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]">
                      <button
                        onClick={() => setPreviewTab("panel")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          previewTab === "panel" ? "bg-discord-brand text-white" : "text-zinc-400"
                        }`}
                      >
                        Panel Embed
                      </button>
                      <button
                        onClick={() => setPreviewTab("welcome")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          previewTab === "welcome" ? "bg-discord-brand text-white" : "text-zinc-400"
                        }`}
                      >
                        Welcome Embed
                      </button>
                    </div>
                  </div>

                  {/* Simulated Discord Embed Box */}
                  {previewTab === "panel" ? (
                    <div
                      style={{ borderLeftColor: formPayload.embedColor || "#5865F2" }}
                      className="bg-[#2b2d31] border-l-4 rounded-r-xl p-4 shadow-2xl space-y-3"
                    >
                      <h4 className="font-bold text-white text-base">{formPayload.embedTitle || "Panel Title"}</h4>
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap">{formPayload.embedDescription}</p>

                      {/* Dropdown Select Menu or Button Preview */}
                      {formPayload.displayType === "dropdown" ? (
                        <div className="mt-4 p-2.5 bg-[#1e1f22] border border-[#35373c] rounded-xl flex items-center justify-between text-xs text-zinc-400">
                          <span>🔽 Select an application position...</span>
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="mt-4">
                          <button className="px-4 py-2 bg-discord-brand text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md">
                            <span>{formPayload.buttonEmoji || "📝"}</span>
                            <span>{formPayload.buttonText || "Apply Now"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{ borderLeftColor: formPayload.welcomeColor || "#5865F2" }}
                      className="bg-[#2b2d31] border-l-4 rounded-r-xl p-4 shadow-2xl space-y-3"
                    >
                      <h4 className="font-bold text-white text-base">{formPayload.welcomeTitle}</h4>
                      <p className="text-xs text-zinc-300">{formPayload.welcomeDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#35373c] bg-[#1e1f22] flex items-center justify-end gap-3">
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 bg-[#2b2d31] hover:bg-[#35373c] text-zinc-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveForm}
                className="px-6 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs shadow-lg"
              >
                Save Panel & Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
