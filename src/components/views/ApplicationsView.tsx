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
  ImageIcon,
  BellRing,
} from "lucide-react";

type SubPage = "dashboard" | "panels" | "forms" | "applications" | "questions" | "roles" | "review-queue" | "statistics" | "settings";
type PanelTab = "embed" | "dm_embed" | "welcome" | "decisions" | "forms" | "channels";

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

  const [panels, setPanels] = useState<any[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);

  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  // Filter & Search states
  const [loading, setLoading] = useState(false);

  // Panel Modal & Editor states
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<any>(null);
  const [panelModalTab, setPanelModalTab] = useState<PanelTab>("embed");
  const [previewTab, setPreviewTab] = useState<"panel" | "dm" | "welcome" | "accepted" | "denied">("panel");

  const [panelPayload, setPanelPayload] = useState<any>({
    name: "Application Center",
    description: "Main application panel for server roles.",
    displayType: "dropdown",
    embedTitle: "📝 Server Application Center",
    embedDescription: "Select an application position from the dropdown menu below to submit your application.",
    embedColor: "#5865F2",
    embedAuthorName: "",
    embedAuthorIcon: "",
    embedAuthorUrl: "",
    thumbnail: "",
    image: "",
    footer: "GuildPilot Applications System",
    footerIcon: "",
    showTimestamp: true,

    dmTitle: "📝 Application Intake",
    dmDescription: "Welcome! Click the button below to answer your application questions.",
    dmColor: "#5865F2",
    dmAuthorName: "",
    dmAuthorIcon: "",
    dmThumbnail: "",
    dmImage: "",
    dmFooter: "GuildPilot Application System",
    dmFooterIcon: "",

    welcomeTitle: "👋 Application Submitted!",
    welcomeDescription: "Your application has been received. Reviewers will inspect your answers shortly.",
    welcomeColor: "#5865F2",
    welcomeAuthorName: "",
    welcomeAuthorIcon: "",
    welcomeThumbnail: "",
    welcomeImage: "",
    welcomeFooter: "GuildPilot Applications System",
    welcomeFooterIcon: "",

    acceptMessage: "🎉 Congratulations {user}! Your application for {form_name} (App #{app_number}) was ACCEPTED!",
    acceptEmbedTitle: "🎉 Application Accepted!",
    acceptEmbedDescription: "Congratulations! Your application has been accepted by our staff team.",
    acceptEmbedColor: "#23A55A",

    denyMessage: "❌ Hello {user}, your application for {form_name} (App #{app_number}) was DENIED.",
    denyEmbedTitle: "❌ Application Decision",
    denyEmbedDescription: "Thank you for applying. Unfortunately, your application was not accepted at this time.",
    denyEmbedColor: "#F23F43",

    waitlistMessage: "⏳ Hello {user}, your application for {form_name} (App #{app_number}) was placed on WAITLIST.",
    waitlistEmbedTitle: "⏳ Application Waitlisted",
    waitlistEmbedDescription: "Your application has been placed on our waitlist. We will contact you when a position opens up.",
    waitlistEmbedColor: "#F0B232",

    channelId: "",
  });

  // Form Modal & Editor states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);

  const [formPayload, setFormPayload] = useState<any>({
    name: "Staff Application",
    description: "Apply to join our server staff team.",
    emoji: "🛡️",
    category: "Staff",
    panelId: "",
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

  // Fetch Core Data
  const fetchData = useCallback(async () => {
    if (!selectedGuildId) return;
    setLoading(true);
    try {
      const [statsRes, panelsRes, formsRes, appsRes] = await Promise.all([
        api.get(`/guilds/${selectedGuildId}/applications/stats`).catch(() => ({ data: {} })),
        api.get(`/guilds/${selectedGuildId}/applications/panels`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/applications/forms`).catch(() => ({ data: [] })),
        api.get(`/guilds/${selectedGuildId}/applications/apps`).catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data || {});
      setPanels(panelsRes.data || []);
      setForms(formsRes.data || []);
      setApplications(appsRes.data || []);

      if (panelsRes.data && panelsRes.data.length > 0 && !selectedPanelId) {
        setSelectedPanelId(panelsRes.data[0].id);
      }
      if (formsRes.data && formsRes.data.length > 0 && !selectedFormId) {
        setSelectedFormId(formsRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load applications data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGuildId, selectedPanelId, selectedFormId]);

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

  // Panel Handlers
  const handleOpenPanelModal = (panel?: any) => {
    if (panel) {
      setEditingPanel(panel);
      setSelectedPanelId(panel.id);
      setPanelPayload({
        name: panel.name,
        description: panel.description || "",
        displayType: panel.displayType || "dropdown",
        embedTitle: panel.embedTitle || "",
        embedDescription: panel.embedDescription || "",
        embedColor: panel.embedColor || "#5865F2",
        embedAuthorName: panel.embedAuthorName || "",
        embedAuthorIcon: panel.embedAuthorIcon || "",
        embedAuthorUrl: panel.embedAuthorUrl || "",
        thumbnail: panel.thumbnail || "",
        image: panel.image || "",
        footer: panel.footer || "",
        footerIcon: panel.footerIcon || "",
        showTimestamp: panel.showTimestamp !== false,

        dmTitle: panel.dmTitle || "📝 Application Intake",
        dmDescription: panel.dmDescription || "Welcome! Click the button below to answer your application questions.",
        dmColor: panel.dmColor || "#5865F2",
        dmAuthorName: panel.dmAuthorName || "",
        dmAuthorIcon: panel.dmAuthorIcon || "",
        dmThumbnail: panel.dmThumbnail || "",
        dmImage: panel.dmImage || "",
        dmFooter: panel.dmFooter || "GuildPilot Application System",
        dmFooterIcon: panel.dmFooterIcon || "",

        welcomeTitle: panel.welcomeTitle || "👋 Application Submitted!",
        welcomeDescription: panel.welcomeDescription || "Your application has been received.",
        welcomeColor: panel.welcomeColor || "#5865F2",
        welcomeAuthorName: panel.welcomeAuthorName || "",
        welcomeAuthorIcon: panel.welcomeAuthorIcon || "",
        welcomeThumbnail: panel.welcomeThumbnail || "",
        welcomeImage: panel.welcomeImage || "",
        welcomeFooter: panel.welcomeFooter || "",
        welcomeFooterIcon: panel.welcomeFooterIcon || "",

        acceptMessage: panel.acceptMessage || "🎉 Congratulations {user}! Your application for {form_name} (App #{app_number}) was ACCEPTED!",
        acceptEmbedTitle: panel.acceptEmbedTitle || "🎉 Application Accepted!",
        acceptEmbedDescription: panel.acceptEmbedDescription || "Congratulations! Your application has been accepted by our staff team.",
        acceptEmbedColor: panel.acceptEmbedColor || "#23A55A",

        denyMessage: panel.denyMessage || "❌ Hello {user}, your application for {form_name} (App #{app_number}) was DENIED.",
        denyEmbedTitle: panel.denyEmbedTitle || "❌ Application Decision",
        denyEmbedDescription: panel.denyEmbedDescription || "Thank you for applying. Unfortunately, your application was not accepted at this time.",
        denyEmbedColor: panel.denyEmbedColor || "#F23F43",

        waitlistMessage: panel.waitlistMessage || "⏳ Hello {user}, your application for {form_name} (App #{app_number}) was placed on WAITLIST.",
        waitlistEmbedTitle: panel.waitlistEmbedTitle || "⏳ Application Waitlisted",
        waitlistEmbedDescription: panel.waitlistEmbedDescription || "Your application has been placed on our waitlist. We will contact you when a position opens up.",
        waitlistEmbedColor: panel.waitlistEmbedColor || "#F0B232",

        channelId: panel.channelId || "",
      });
    } else {
      setEditingPanel(null);
      setPanelPayload({
        name: "Application Center Panel",
        description: "Main application panel for server positions.",
        displayType: "dropdown",
        embedTitle: "📝 Server Application Center",
        embedDescription: "Select an application position from the dropdown menu below to submit your application.",
        embedColor: "#5865F2",
        embedAuthorName: "",
        embedAuthorIcon: "",
        embedAuthorUrl: "",
        thumbnail: "",
        image: "",
        footer: "GuildPilot Applications System",
        footerIcon: "",
        showTimestamp: true,

        dmTitle: "📝 Application Intake",
        dmDescription: "Welcome! Click the button below to answer your application questions.",
        dmColor: "#5865F2",
        dmAuthorName: "",
        dmAuthorIcon: "",
        dmThumbnail: "",
        dmImage: "",
        dmFooter: "GuildPilot Application System",
        dmFooterIcon: "",

        welcomeTitle: "👋 Application Submitted!",
        welcomeDescription: "Your application has been received.",
        welcomeColor: "#5865F2",
        welcomeAuthorName: "",
        welcomeAuthorIcon: "",
        welcomeThumbnail: "",
        welcomeImage: "",
        welcomeFooter: "GuildPilot Applications System",
        welcomeFooterIcon: "",

        acceptMessage: "🎉 Congratulations {user}! Your application for {form_name} (App #{app_number}) was ACCEPTED!",
        acceptEmbedTitle: "🎉 Application Accepted!",
        acceptEmbedDescription: "Congratulations! Your application has been accepted by our staff team.",
        acceptEmbedColor: "#23A55A",

        denyMessage: "❌ Hello {user}, your application for {form_name} (App #{app_number}) was DENIED.",
        denyEmbedTitle: "❌ Application Decision",
        denyEmbedDescription: "Thank you for applying. Unfortunately, your application was not accepted at this time.",
        denyEmbedColor: "#F23F43",

        waitlistMessage: "⏳ Hello {user}, your application for {form_name} (App #{app_number}) was placed on WAITLIST.",
        waitlistEmbedTitle: "⏳ Application Waitlisted",
        waitlistEmbedDescription: "Your application has been placed on our waitlist. We will contact you when a position opens up.",
        waitlistEmbedColor: "#F0B232",

        channelId: "",
      });
    }
    setPanelModalTab("embed");
    setPreviewTab("panel");
    setIsPanelModalOpen(true);
  };

  const handleSavePanel = async () => {
    if (!selectedGuildId) return;
    try {
      if (editingPanel) {
        await api.patch(`/guilds/${selectedGuildId}/applications/panels/${editingPanel.id}`, panelPayload);
        showToast("Application Panel updated!", "success");
      } else {
        const res = await api.post(`/guilds/${selectedGuildId}/applications/panels`, panelPayload);
        setSelectedPanelId(res.data.id);
        showToast("Application Panel created!", "success");
      }
      setIsPanelModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save panel", "error");
    }
  };

  const handleDeletePanel = async (panelId: string) => {
    if (!selectedGuildId || !confirm("Delete this panel?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/applications/panels/${panelId}`);
      showToast("Panel deleted", "success");
      if (selectedPanelId === panelId) setSelectedPanelId(null);
      fetchData();
    } catch (err: any) {
      showToast("Failed to delete panel", "error");
    }
  };

  const handleDeployPanel = async (panelId: string) => {
    if (!selectedGuildId) return;
    try {
      await api.post(`/guilds/${selectedGuildId}/applications/panels/${panelId}/deploy`);
      showToast("Application Panel deployed to Discord channel!", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to deploy panel embed", "error");
    }
  };

  // Form Handlers
  const handleOpenFormModal = (form?: any, panelId?: string) => {
    if (form) {
      setEditingForm(form);
      setSelectedFormId(form.id);
      setFormPayload({
        name: form.name,
        description: form.description || "",
        emoji: form.emoji || "📝",
        category: form.category || "General",
        panelId: form.panelId || panelId || selectedPanelId || "",
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
        name: "New Position Form",
        description: "Apply for this position.",
        emoji: "📝",
        category: "General",
        panelId: panelId || selectedPanelId || "",
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
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async () => {
    if (!selectedGuildId) return;
    try {
      if (editingForm) {
        await api.patch(`/guilds/${selectedGuildId}/applications/forms/${editingForm.id}`, formPayload);
        showToast("Application Form updated!", "success");
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
    if (!selectedGuildId || !confirm("Delete this form?")) return;
    try {
      await api.delete(`/guilds/${selectedGuildId}/applications/forms/${formId}`);
      showToast("Form deleted", "success");
      if (selectedFormId === formId) setSelectedFormId(null);
      fetchData();
    } catch (err: any) {
      showToast("Failed to delete form", "error");
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
        showToast("Question updated!", "success");
      } else {
        await api.post(`/guilds/${selectedGuildId}/applications/forms/${targetFormId}/questions`, payload);
        showToast("Question added!", "success");
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
                Custom DM & Decision Messages
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Customize intake DM embeds, accepted/denied/waitlisted notification messages per form
            </p>
          </div>
        </div>

        {/* Sub-Pages Navigation Bar */}
        <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "panels", label: "Panels", icon: Layers },
            { id: "forms", label: "Forms", icon: FileText },
            { id: "applications", label: "Applications", icon: ClipboardList },
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
        {/* DASHBOARD */}
        {activeSubPage === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Panels</p>
                  <h3 className="text-3xl font-extrabold text-white mt-1">{panels.length}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-discord-brand/10 border border-discord-brand/30 flex items-center justify-center text-discord-brand">
                  <Layers className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Forms</p>
                  <h3 className="text-3xl font-extrabold text-white mt-1">{forms.length}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <FileText className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Accepted</p>
                  <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">{stats.accepted || 0}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 shadow-lg flex items-center justify-between">
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
        )}

        {/* PANELS SUB-PAGE */}
        {activeSubPage === "panels" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Application Panels</h2>
                <p className="text-xs text-zinc-400">Configure Intake Messages & Decision Messages per Panel/Form</p>
              </div>
              <button
                onClick={() => handleOpenPanelModal()}
                className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create Panel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {panels.map((p) => (
                <div key={p.id} className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#35373c] pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-discord-brand px-2.5 py-0.5 rounded-full bg-discord-brand/10 border border-discord-brand/30">
                        {p.displayType === "dropdown" ? "🔽 Dropdown Menu" : "🔘 Buttons"}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{p.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeployPanel(p.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Deploy
                      </button>
                      <button
                        onClick={() => handleOpenPanelModal(p)}
                        className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300 hover:text-white"
                      >
                        <Edit className="w-4 h-4" /> Edit Embeds & Messages
                      </button>
                      <button
                        onClick={() => handleDeletePanel(p.id)}
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Attached Forms */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                      <span>Attached Forms ({p.forms?.length || 0}):</span>
                      <button
                        onClick={() => handleOpenFormModal(undefined, p.id)}
                        className="text-discord-brand hover:underline flex items-center gap-1"
                      >
                        + Add Form to Panel
                      </button>
                    </div>

                    {p.forms && p.forms.length > 0 ? (
                      <div className="space-y-2">
                        {p.forms.map((f: any) => (
                          <div
                            key={f.id}
                            className="p-3 bg-[#1e1f22] rounded-xl border border-[#35373c] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{f.emoji || "📝"}</span>
                              <div>
                                <p className="font-bold text-white">{f.name}</p>
                                <p className="text-[10px] text-zinc-400">{f.questions?.length || 0} questions</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenFormModal(f)}
                                className="p-1.5 rounded-lg bg-[#2b2d31] text-zinc-300 hover:text-white"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteForm(f.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-[#1e1f22] rounded-xl border border-[#35373c] text-xs text-zinc-400">
                        No forms attached. Click "+ Add Form to Panel" above!
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FORMS SUB-PAGE */}
        {activeSubPage === "forms" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">All Application Forms</h2>
                <p className="text-xs text-zinc-400">Create & manage forms across all panels</p>
              </div>
              <button
                onClick={() => handleOpenFormModal()}
                className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create Form
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map((f) => (
                <div key={f.id} className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-base">{f.emoji || "📝"}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-discord-brand/20 text-discord-brand">
                      {f.panel?.name || "Standalone Form"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{f.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{f.description || "No description."}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#35373c] text-xs">
                    <button onClick={() => handleOpenFormModal(f)} className="px-3 py-1.5 bg-[#1e1f22] text-white rounded-lg font-bold">Edit</button>
                    <button onClick={() => handleDeleteForm(f.id)} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg font-bold">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUESTIONS SUB-PAGE */}
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
                  className="bg-[#1e1f22] border border-[#35373c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-discord-brand font-bold"
                >
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleOpenQuestionModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Question
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="font-bold text-white text-sm">{q.label}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-discord-brand/20 text-discord-brand">{q.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenQuestionModal(q)} className="p-2 rounded-xl bg-[#1e1f22] text-zinc-300"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FULL EMBED & DECISION MESSAGES PANEL MODAL */}
      {isPanelModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header with Tabs */}
            <div className="p-4 border-b border-[#35373c] bg-[#1e1f22] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-discord-brand" />
                {editingPanel ? "Full Embed Customizer & Decision Messages" : "Create Application Panel"}
              </h3>

              <div className="flex items-center gap-1 bg-[#2b2d31] p-1 rounded-xl border border-[#35373c]">
                {[
                  { id: "embed", label: "1. Panel Embed", icon: Palette },
                  { id: "dm_embed", label: "2. Intake DM Embed", icon: MessageSquare },
                  { id: "welcome", label: "3. Review Embed", icon: Sparkles },
                  { id: "decisions", label: "4. Decision Messages", icon: BellRing },
                  { id: "channels", label: "5. Channels", icon: Hash },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setPanelModalTab(t.id as PanelTab);
                      if (t.id === "embed") setPreviewTab("panel");
                      if (t.id === "dm_embed") setPreviewTab("dm");
                      if (t.id === "welcome") setPreviewTab("welcome");
                      if (t.id === "decisions") setPreviewTab("accepted");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      panelModalTab === t.id ? "bg-discord-brand text-white shadow" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Grid: Left Column (Embed & Decision Controls) | Right Column (Live Discord Preview) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
              {/* Left Column: Controls */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs border-r border-[#35373c]">
                {panelModalTab === "embed" && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-white text-sm border-b border-[#35373c] pb-2 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-discord-brand" /> Panel Channel Embed Settings
                    </h4>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Panel Name:</label>
                      <input
                        type="text"
                        value={panelPayload.name}
                        onChange={(e) => setPanelPayload({ ...panelPayload, name: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Display Mode (Discord Interface):</label>
                      <select
                        value={panelPayload.displayType}
                        onChange={(e) => setPanelPayload({ ...panelPayload, displayType: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-bold"
                      >
                        <option value="dropdown">🔽 Dropdown Menu Select (StringSelectMenu)</option>
                        <option value="button">🔘 Buttons Row (ActionRow Buttons)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Embed Title:</label>
                      <input
                        type="text"
                        value={panelPayload.embedTitle}
                        onChange={(e) => setPanelPayload({ ...panelPayload, embedTitle: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Embed Description:</label>
                      <textarea
                        rows={3}
                        value={panelPayload.embedDescription}
                        onChange={(e) => setPanelPayload({ ...panelPayload, embedDescription: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Embed Color (Hex):</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={panelPayload.embedColor}
                          onChange={(e) => setPanelPayload({ ...panelPayload, embedColor: e.target.value })}
                          className="w-12 h-10 bg-[#1e1f22] border border-[#35373c] rounded-xl cursor-pointer p-1"
                        />
                        <input
                          type="text"
                          value={panelPayload.embedColor}
                          onChange={(e) => setPanelPayload({ ...panelPayload, embedColor: e.target.value })}
                          className="flex-1 bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {panelModalTab === "dm_embed" && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-white text-sm border-b border-[#35373c] pb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-discord-brand" /> Applicant Intake Direct Message (DM) Embed
                    </h4>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">DM Embed Title:</label>
                      <input
                        type="text"
                        value={panelPayload.dmTitle}
                        onChange={(e) => setPanelPayload({ ...panelPayload, dmTitle: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">DM Embed Description:</label>
                      <textarea
                        rows={3}
                        value={panelPayload.dmDescription}
                        onChange={(e) => setPanelPayload({ ...panelPayload, dmDescription: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                      />
                    </div>
                  </div>
                )}

                {panelModalTab === "decisions" && (
                  <div className="space-y-6">
                    <div className="border-b border-[#35373c] pb-3">
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-emerald-400" /> Accept, Deny & Waitlist Decision Messages
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Use placeholders: <code className="text-discord-brand font-mono">{`{user}`}</code>, <code className="text-discord-brand font-mono">{`{form_name}`}</code>, <code className="text-discord-brand font-mono">{`{app_number}`}</code>, <code className="text-discord-brand font-mono">{`{reason}`}</code>
                      </p>
                    </div>

                    {/* ACCEPT MESSAGE SETTINGS */}
                    <div className="p-4 bg-[#1e1f22] rounded-xl border border-emerald-500/30 space-y-3">
                      <h5 className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Accepted Notification DM
                      </h5>
                      <div>
                        <label className="font-bold text-zinc-300 block mb-1">Accept Message Content:</label>
                        <input
                          type="text"
                          value={panelPayload.acceptMessage}
                          onChange={(e) => setPanelPayload({ ...panelPayload, acceptMessage: e.target.value })}
                          className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl p-2.5 text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-zinc-300 block mb-1">Accept Embed Title:</label>
                          <input
                            type="text"
                            value={panelPayload.acceptEmbedTitle}
                            onChange={(e) => setPanelPayload({ ...panelPayload, acceptEmbedTitle: e.target.value })}
                            className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl p-2.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-zinc-300 block mb-1">Accept Embed Color:</label>
                          <input
                            type="color"
                            value={panelPayload.acceptEmbedColor}
                            onChange={(e) => setPanelPayload({ ...panelPayload, acceptEmbedColor: e.target.value })}
                            className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl h-10 cursor-pointer p-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* DENY MESSAGE SETTINGS */}
                    <div className="p-4 bg-[#1e1f22] rounded-xl border border-rose-500/30 space-y-3">
                      <h5 className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> Denied Notification DM
                      </h5>
                      <div>
                        <label className="font-bold text-zinc-300 block mb-1">Deny Message Content:</label>
                        <input
                          type="text"
                          value={panelPayload.denyMessage}
                          onChange={(e) => setPanelPayload({ ...panelPayload, denyMessage: e.target.value })}
                          className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl p-2.5 text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-zinc-300 block mb-1">Deny Embed Title:</label>
                          <input
                            type="text"
                            value={panelPayload.denyEmbedTitle}
                            onChange={(e) => setPanelPayload({ ...panelPayload, denyEmbedTitle: e.target.value })}
                            className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl p-2.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-zinc-300 block mb-1">Deny Embed Color:</label>
                          <input
                            type="color"
                            value={panelPayload.denyEmbedColor}
                            onChange={(e) => setPanelPayload({ ...panelPayload, denyEmbedColor: e.target.value })}
                            className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl h-10 cursor-pointer p-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {panelModalTab === "channels" && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-bold text-zinc-300 block mb-1">Target Panel Channel:</label>
                      <select
                        value={panelPayload.channelId || ""}
                        onChange={(e) => setPanelPayload({ ...panelPayload, channelId: e.target.value })}
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
                  </div>
                )}
              </div>

              {/* Right Column: Live Discord Embed Preview Switcher */}
              <div className="p-6 bg-[#313338] overflow-y-auto flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-discord-brand" /> Live Discord Embed Preview
                    </span>

                    <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-[#35373c]">
                      <button
                        onClick={() => setPreviewTab("panel")}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          previewTab === "panel" ? "bg-discord-brand text-white" : "text-zinc-400"
                        }`}
                      >
                        Panel Embed
                      </button>
                      <button
                        onClick={() => setPreviewTab("dm")}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          previewTab === "dm" ? "bg-discord-brand text-white" : "text-zinc-400"
                        }`}
                      >
                        Intake DM
                      </button>
                      <button
                        onClick={() => setPreviewTab("accepted")}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          previewTab === "accepted" ? "bg-emerald-600 text-white" : "text-zinc-400"
                        }`}
                      >
                        Accepted DM
                      </button>
                      <button
                        onClick={() => setPreviewTab("denied")}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          previewTab === "denied" ? "bg-rose-600 text-white" : "text-zinc-400"
                        }`}
                      >
                        Denied DM
                      </button>
                    </div>
                  </div>

                  {/* Simulated Live Discord Embed Box */}
                  {previewTab === "panel" && (
                    <div
                      style={{ borderLeftColor: panelPayload.embedColor || "#5865F2" }}
                      className="bg-[#2b2d31] border-l-4 rounded-r-xl p-4 shadow-2xl space-y-3"
                    >
                      <h4 className="font-bold text-white text-base">{panelPayload.embedTitle || "Panel Title"}</h4>
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap">{panelPayload.embedDescription}</p>
                    </div>
                  )}

                  {previewTab === "dm" && (
                    <div
                      style={{ borderLeftColor: panelPayload.dmColor || "#5865F2" }}
                      className="bg-[#2b2d31] border-l-4 rounded-r-xl p-4 shadow-2xl space-y-3"
                    >
                      <h4 className="font-bold text-white text-base">{panelPayload.dmTitle || "DM Title"}</h4>
                      <p className="text-xs text-zinc-300">{panelPayload.dmDescription}</p>
                    </div>
                  )}

                  {previewTab === "accepted" && (
                    <div
                      style={{ borderLeftColor: panelPayload.acceptEmbedColor || "#23A55A" }}
                      className="bg-[#2b2d31] border-l-4 rounded-r-xl p-4 shadow-2xl space-y-3"
                    >
                      <p className="text-xs font-bold text-emerald-400">{panelPayload.acceptMessage}</p>
                      <h4 className="font-bold text-white text-base">{panelPayload.acceptEmbedTitle}</h4>
                      <p className="text-xs text-zinc-300">{panelPayload.acceptEmbedDescription}</p>
                    </div>
                  )}

                  {previewTab === "denied" && (
                    <div
                      style={{ borderLeftColor: panelPayload.denyEmbedColor || "#F23F43" }}
                      className="bg-[#2b2d31] border-l-4 rounded-r-xl p-4 shadow-2xl space-y-3"
                    >
                      <p className="text-xs font-bold text-rose-400">{panelPayload.denyMessage}</p>
                      <h4 className="font-bold text-white text-base">{panelPayload.denyEmbedTitle}</h4>
                      <p className="text-xs text-zinc-300">{panelPayload.denyEmbedDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#35373c] bg-[#1e1f22] flex items-center justify-end gap-3">
              <button
                onClick={() => setIsPanelModalOpen(false)}
                className="px-4 py-2 bg-[#2b2d31] hover:bg-[#35373c] text-zinc-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePanel}
                className="px-6 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs shadow-lg"
              >
                Save All Embed & Decision Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Editor Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#35373c] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-discord-brand" />
                {editingForm ? "Edit Application Form" : "Create Application Form"}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="p-1 rounded bg-[#1e1f22] text-zinc-400">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Parent Panel:</label>
                <select
                  value={formPayload.panelId || ""}
                  onChange={(e) => setFormPayload({ ...formPayload, panelId: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-bold"
                >
                  <option value="">None (Standalone Form)</option>
                  {panels.map((p) => (
                    <option key={p.id} value={p.id}>
                      📂 {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Form Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Moderator Application"
                  value={formPayload.name}
                  onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Emoji (Displayed in Dropdown):</label>
                <input
                  type="text"
                  placeholder="e.g. 🛡️ or 🔨"
                  value={formPayload.emoji}
                  onChange={(e) => setFormPayload({ ...formPayload, emoji: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Description (Displayed in Dropdown):</label>
                <input
                  type="text"
                  placeholder="e.g. Apply to become a server moderator"
                  value={formPayload.description}
                  onChange={(e) => setFormPayload({ ...formPayload, description: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
              <button onClick={() => setIsFormModalOpen(false)} className="px-4 py-2 bg-[#1e1f22] text-zinc-300 rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={handleSaveForm} className="px-5 py-2 bg-discord-brand hover:bg-discord-brandHover text-white font-bold rounded-xl text-xs">Save Form</button>
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
                {editingQuestion ? "Edit Question" : "Add Question"}
              </h3>
              <button onClick={() => setIsQuestionModalOpen(false)} className="p-1 rounded bg-[#1e1f22] text-zinc-400">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Target Form:</label>
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
                <label className="font-bold text-zinc-300 block mb-1">Question Label:</label>
                <input
                  type="text"
                  placeholder="e.g. Why do you want to join our team?"
                  value={questionPayload.label}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, label: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Type:</label>
                <select
                  value={questionPayload.type}
                  onChange={(e) => setQuestionPayload({ ...questionPayload, type: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#35373c] rounded-xl p-2.5 text-white font-bold"
                >
                  <option value="SHORT_TEXT">Short Text</option>
                  <option value="PARAGRAPH">Paragraph</option>
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="DROPDOWN">Dropdown Menu</option>
                  <option value="YES_NO">Yes / No</option>
                  <option value="NUMBER">Number Input</option>
                  <option value="DATE">Date Input</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#35373c]">
              <button onClick={() => setIsQuestionModalOpen(false)} className="px-4 py-2 bg-[#1e1f22] text-zinc-300 rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={handleSaveQuestion} className="px-5 py-2 bg-discord-brand text-white font-bold rounded-xl text-xs">Save Question</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
