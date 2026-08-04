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
type FormTab = "embed" | "welcome" | "questions" | "channels" | "roles";

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
      setSelectedFormId(form.id);
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
    let targetFormId = selectedFormId;
    if (!targetFormId && forms.length > 0) {
      targetFormId = forms[0].id;
      setSelectedFormId(targetFormId);
    }

    if (!targetFormId) {
      showToast("Please create an Application Form first before adding questions!", "error");
      return;
    }

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
    let targetFormId = selectedFormId;
    if (!targetFormId && forms.length > 0) {
      targetFormId = forms[0].id;
      setSelectedFormId(targetFormId);
    }

    if (!selectedGuildId || !targetFormId) {
      showToast("Please select or create an Application Form first!", "error");
      return;
    }

    if (!questionPayload.label.trim()) {
      showToast("Question label/title is required!", "error");
      return;
    }

    try {
      const optionsArray = (questionPayload.options || "")
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const payload = {
        ...questionPayload,
        options: optionsArray,
      };

      if (editingQuestion) {
        await api.patch(`/guilds/${selectedGuildId}/applications/questions/${editingQuestion.id}`, payload);
        showToast("Question updated successfully!", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/applications/forms/${targetFormId}/questions`, payload);
        showToast("Question added successfully!", "success");
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

  const selectedForm = forms.find((f) => f.id === selectedFormId) || forms[0];

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#2b2d31] p-4 rounded-2xl border border-[#35373c]">
              <div>
                <h2 className="text-xl font-bold text-white">Question Builder</h2>
                <p className="text-xs text-zinc-400">
                  Target Form: <span className="font-bold text-discord-brand">{selectedForm?.name || "No form created"}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {forms.length > 0 ? (
                  <select
                    value={selectedFormId || ""}
                    onChange={(e) => setSelectedFormId(e.target.value)}
                    className="bg-[#1e1f22] border border-[#35373c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-discord-brand font-bold"
                  >
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => handleOpenFormModal()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
                  >
                    + Create Form First
                  </button>
                )}

                <button
                  onClick={() => handleOpenQuestionModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Question
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {questions.length === 0 ? (
                <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-8 text-center space-y-3">
                  <HelpCircle className="w-10 h-10 text-discord-brand mx-auto" />
                  <h3 className="text-base font-bold text-white">No Intake Questions Added Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Add questions to <strong>{selectedForm?.name || "this application form"}</strong> for applicants to answer when applying.
                  </p>
                  <button
                    onClick={() => handleOpenQuestionModal()}
                    className="px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create First Question
                  </button>
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id} className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-4 flex items-center justify-between shadow-md">
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
                          {q.required && <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">Required</span>}
                        </div>
                        {q.placeholder && <p className="text-xs text-zinc-400 mt-1">Placeholder: "{q.placeholder}"</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDuplicateQuestion(q.id)} title="Duplicate Question" className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handleOpenQuestionModal(q)} title="Edit Question" className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteQuestion(q.id)} title="Delete Question" className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button>
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
                  { id: "questions", label: "Questions", icon: HelpCircle },
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

                {formModalTab === "questions" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#35373c] pb-2">
                      <h4 className="font-bold text-white text-sm">Form Intake Questions</h4>
                      <button
                        onClick={() => handleOpenQuestionModal()}
                        className="px-3 py-1.5 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Question
                      </button>
                    </div>

                    <div className="space-y-2">
                      {questions.length === 0 ? (
                        <p className="text-zinc-400 text-center py-6">No questions added to this form yet.</p>
                      ) : (
                        questions.map((q, idx) => (
                          <div key={q.id} className="p-3 bg-[#1e1f22] rounded-xl border border-[#35373c] flex items-center justify-between">
                            <div>
                              <p className="font-bold text-white text-xs">{idx + 1}. {q.label}</p>
                              <span className="text-[10px] text-discord-brand font-mono">{q.type}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleOpenQuestionModal(q)} className="p-1 rounded text-zinc-400 hover:text-white"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteQuestion(q.id)} className="p-1 rounded text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))
                      )}
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

      {/* Question Editor Modal */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#35373c] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-discord-brand" />
                {editingQuestion ? "Edit Intake Question" : "Add Intake Question"}
              </h3>
              <button
                onClick={() => setIsQuestionModalOpen(false)}
                className="p-1 rounded-lg bg-[#1e1f22] text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Target Form / Panel:</label>
                <select
                  value={selectedFormId || ""}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-semibold"
                >
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Question Label / Title:</label>
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
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-bold"
                >
                  <option value="SHORT_TEXT">Short Text (Single line)</option>
                  <option value="PARAGRAPH">Paragraph (Multi-line text)</option>
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="DROPDOWN">Dropdown Menu Select</option>
                  <option value="YES_NO">Yes / No</option>
                  <option value="NUMBER">Number Input</option>
                  <option value="DATE">Date Input</option>
                </select>
              </div>

              {["MULTIPLE_CHOICE", "DROPDOWN"].includes(questionPayload.type) && (
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Options (One option per line):</label>
                  <textarea
                    rows={4}
                    placeholder={`Option 1\nOption 2\nOption 3`}
                    value={questionPayload.options}
                    onChange={(e) => setQuestionPayload({ ...questionPayload, options: e.target.value })}
                    className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Placeholder (Optional):</label>
                <input
                  type="text"
                  placeholder="Type answer here..."
                  value={questionPayload.placeholder}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, placeholder: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Help Text / Guidance (Optional):</label>
                <input
                  type="text"
                  placeholder="Provide guidance for the applicant..."
                  value={questionPayload.helpText}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, helpText: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="q_req"
                  checked={questionPayload.required}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, required: e.target.checked })}
                  className="w-4 h-4 rounded text-discord-brand focus:ring-0"
                />
                <label htmlFor="q_req" className="font-bold text-white cursor-pointer">
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
                className="px-5 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs shadow-lg"
              >
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
