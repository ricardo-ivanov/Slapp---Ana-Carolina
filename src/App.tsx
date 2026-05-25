import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  BarChart3,
  Plus,
  Search,
  Share2,
  Copy,
  Download,
  Edit,
  Trash2,
  Lock,
  User,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  LogOut,
  Eye,
  EyeOff,
  Save,
  FileSpreadsheet,
  FileText,
  FileCode,
  Calendar,
  Layers,
  Phone,
  QrCode,
  Settings,
  ArrowUp,
  ArrowDown,
  LockOpen,
  Mail,
  LogIn,
  Menu,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  isSupabaseConfigured,
  testSupabaseConnection,
  fetchProfile,
  upsertProfile,
  fetchLeaders,
  upsertLeader,
  deleteLeaderFromDB,
  fetchRegistrations,
  upsertRegistration,
  deleteRegistrationFromDB,
  fetchFormFields,
  upsertFormField,
  deleteFormFieldFromDB
} from './supabaseClient';
import {
  INITIAL_PROFILE,
  INITIAL_LEADERS,
  INITIAL_REGISTRATIONS,
  INITIAL_FORM_FIELDS,
  CATEGORIES_LIST
} from './data';
import { Registration, Leader, FormField, UserProfile, ActiveView } from './types';
import { QRCodeImage } from './components/QRCodeImage';
import QRCode from 'qrcode';

function maskCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return `(${cleaned}`;
  if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  }
  if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
}

function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

  return true;
}

export default function App() {
  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const stored = localStorage.getItem('isLoggedIn');
    return stored ? JSON.parse(stored) : true; // Default to true so user sees the premium admin core first
  });

  const [loginEmail, setLoginEmail] = useState('ana.carolina@lideranca.com');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);

  // Administrative States
  const [profile, setProfile] = useState<UserProfile>(() => {
    const stored = localStorage.getItem('admin_profile');
    return stored ? JSON.parse(stored) : INITIAL_PROFILE;
  });

  const [leaders, setLeaders] = useState<Leader[]>(() => {
    const stored = localStorage.getItem('admin_leaders');
    return stored ? JSON.parse(stored) : INITIAL_LEADERS;
  });

  const [registrations, setRegistrations] = useState<Registration[]>(() => {
    const stored = localStorage.getItem('admin_registrations');
    return stored ? JSON.parse(stored) : INITIAL_REGISTRATIONS;
  });

  const [formFields, setFormFields] = useState<FormField[]>(() => {
    const stored = localStorage.getItem('admin_form_fields');
    return stored ? JSON.parse(stored) : INITIAL_FORM_FIELDS;
  });

  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const stored = localStorage.getItem('active_view');
    return (stored as ActiveView) || 'dashboard';
  });

  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isLoadingFromSupabase, setIsLoadingFromSupabase] = useState(false);

  // UI States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotification, setShowNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddRegistrationModal, setShowAddRegistrationModal] = useState(false);
  const [showAddLeaderModal, setShowAddLeaderModal] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [viewingLeaderQR, setViewingLeaderQR] = useState<Leader | null>(null);

  const [viewingRegistration, setViewingRegistration] = useState<Registration | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [registrationToDelete, setRegistrationToDelete] = useState<{ id: string; name: string } | null>(null);
  const [leaderToDelete, setLeaderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editRegName, setEditRegName] = useState('');
  const [editRegLeaderId, setEditRegLeaderId] = useState('');
  const [editRegCategory, setEditRegCategory] = useState('');
  const [editRegDynamicFields, setEditRegDynamicFields] = useState<Record<string, string>>({});
  const [performancePeriod, setPerformancePeriod] = useState<'Diário' | 'Semanal' | 'Mensal'>('Semanal');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Filter State in Reports Screen
  const [filterPeriod, setFilterPeriod] = useState('01/05/2026 - 31/05/2026');
  const [filterStartDate, setFilterStartDate] = useState('2026-05-01');
  const [filterEndDate, setFilterEndDate] = useState('2026-05-31');
  const [filterLeader, setFilterLeader] = useState('Todas as Lideranças');
  const [filterCategory, setFilterCategory] = useState('Todas as Categorias');

  // Synchronize filterPeriod string with visual date selection
  useEffect(() => {
    if (filterStartDate && filterEndDate) {
      const formatDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts;
          return `${day}/${month}/${year}`;
        }
        return dateStr;
      };
      setFilterPeriod(`${formatDate(filterStartDate)} - ${formatDate(filterEndDate)}`);
    }
  }, [filterStartDate, filterEndDate]);

  // New Registration Form inputs (constructed dynamically using dynamic fields)
  const [dynamicFormInput, setDynamicFormInput] = useState<Record<string, string>>({});
  const [newRegistrationCategory, setNewRegistrationCategory] = useState(CATEGORIES_LIST[0]);
  const [newRegistrationLeader, setNewRegistrationLeader] = useState('');

  // New Leader Input
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderEmail, setNewLeaderEmail] = useState('');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newLeaderCPF, setNewLeaderCPF] = useState('');

  // Password edit input states
  const [currentPass, setCurrentPass] = useState('••••••••');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Persist values in localStorage
  useEffect(() => {
    localStorage.setItem('isLoggedIn', JSON.stringify(isLoggedIn));
    localStorage.setItem('admin_profile', JSON.stringify(profile));
    localStorage.setItem('admin_leaders', JSON.stringify(leaders));
    localStorage.setItem('admin_registrations', JSON.stringify(registrations));
    localStorage.setItem('admin_form_fields', JSON.stringify(formFields));
    localStorage.setItem('active_view', activeView);
  }, [isLoggedIn, profile, leaders, registrations, formFields, activeView]);

  // Set default leader selection for new registrations
  useEffect(() => {
    if (leaders.length > 0 && !newRegistrationLeader) {
      setNewRegistrationLeader(leaders[0].id);
    }
  }, [leaders, newRegistrationLeader]);

  // Supabase Database Connection & Seeding effect
  useEffect(() => {
    const initSupabase = async () => {
      if (!isSupabaseConfigured) {
        console.log('Supabase: credentials are not configured in .env properties. Running in offline localStorage fallback mode.');
        return;
      }
      setIsLoadingFromSupabase(true);
      const connected = await testSupabaseConnection();
      setIsSupabaseConnected(connected);

      if (connected) {
        try {
          // 1. Fetch Profile
          const dbProfile = await fetchProfile('p1');
          if (dbProfile) {
            setProfile(dbProfile);
          } else {
            await upsertProfile('p1', INITIAL_PROFILE);
          }

          // 2. Fetch Leaders
          const dbLeaders = await fetchLeaders();
          if (dbLeaders && dbLeaders.length > 0) {
            setLeaders(dbLeaders);
          } else {
            for (const leader of INITIAL_LEADERS) {
              await upsertLeader(leader);
            }
            setLeaders(INITIAL_LEADERS);
          }

          // 3. Fetch Registrations
          const dbRegs = await fetchRegistrations();
          if (dbRegs && dbRegs.length > 0) {
            setRegistrations(dbRegs);
          } else {
            for (const reg of INITIAL_REGISTRATIONS) {
              await upsertRegistration(reg);
            }
            setRegistrations(INITIAL_REGISTRATIONS);
          }

          // 4. Fetch Form Fields
          const dbFields = await fetchFormFields();
          if (dbFields && dbFields.length > 0) {
            setFormFields(dbFields);
          } else {
            for (const field of INITIAL_FORM_FIELDS) {
              await upsertFormField(field);
            }
            setFormFields(INITIAL_FORM_FIELDS);
          }

          triggerNotification('Dados sincronizados com o Supabase com sucesso!', 'success');
        } catch (error) {
          console.error('Failed to pre-seed/fetch Supabase database:', error);
          triggerNotification('Conectado ao Supabase, mas erro ao carregar tabelas.', 'error');
        }
      } else {
        triggerNotification('Incapaz de conectar ao Supabase. Rodando localmente.', 'info');
      }
      setIsLoadingFromSupabase(false);
    };

    initSupabase();
  }, []);

  // Form Fields DB Synchronization Hook
  useEffect(() => {
    if (!isSupabaseConnected || isLoadingFromSupabase) return;
    const syncFields = async () => {
      try {
        const dbFields = await fetchFormFields();
        if (dbFields) {
          const currentIds = formFields.map(f => f.id);
          for (const dbF of dbFields) {
            if (!currentIds.includes(dbF.id)) {
              await deleteFormFieldFromDB(dbF.id);
            }
          }
        }
        for (const f of formFields) {
          await upsertFormField(f);
        }
      } catch (err) {
        console.error('Failed to sync form fields to Supabase:', err);
      }
    };
    syncFields();
  }, [formFields, isSupabaseConnected, isLoadingFromSupabase]);

  // Trigger brief alert banners
  const triggerNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setShowNotification({ message, type });
    setTimeout(() => {
      setShowNotification(null);
    }, 4000);
  };

  // Auth Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      triggerNotification('Por favor, informe um email válido.', 'error');
      return;
    }
    // Update administrative profile email dynamically if typed
    setProfile(prev => ({
      ...prev,
      email: loginEmail,
      name: loginEmail === 'ana.carolina@lideranca.com' ? 'Ana Carolina Oliveira' : prev.name
    }));
    setIsLoggedIn(true);
    triggerNotification('Acesso concedido. Bem-vindo de volta!', 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    triggerNotification('Sessão encerrada com sucesso.', 'info');
  };

  // Add Dynamic Field
  const addFieldToForm = (type: FormField['type']) => {
    let label = '';
    let placeholder = '';
    let options: string[] | undefined;

    switch (type) {
      case 'text':
        label = 'Texto Adicional';
        placeholder = 'Digite aqui...';
        break;
      case 'email':
        label = 'E-mail Secundário';
        placeholder = 'contato@email.com';
        break;
      case 'tel':
        label = 'Telefone Celular';
        placeholder = '(00) 00000-0000';
        break;
      case 'cpf':
        label = 'CPF de Verificação';
        placeholder = '000.000.000-00';
        break;
      case 'select':
        label = 'Opção Escolhida';
        options = ['Opção A', 'Opção B', 'Opção C'];
        break;
      case 'h2':
        label = 'Subtítulo da Seção';
        break;
      case 'p':
        label = 'Parágrafo informativo do cadastro...';
        break;
    }

    const newField: FormField = {
      id: 'field_' + Date.now(),
      type,
      label,
      placeholder,
      required: type !== 'h2' && type !== 'p',
      options
    };

    setFormFields([...formFields, newField]);
    triggerNotification('Campo adicionado à configuração!', 'success');
  };

  const deleteField = (id: string) => {
    setFormFields(formFields.filter(f => f.id !== id));
    triggerNotification('Campo removido.', 'info');
  };

  const toggleFieldRequired = (id: string) => {
    setFormFields(formFields.map(f => f.id === id ? { ...f, required: !f.required } : f));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formFields.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...formFields];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setFormFields(reordered);
  };

  const updateFieldValues = (id: string, label: string, placeholder?: string, commaSeparatedOptions?: string) => {
    setFormFields(formFields.map(f => {
      if (f.id === id) {
        return {
          ...f,
          label,
          placeholder,
          options: commaSeparatedOptions ? commaSeparatedOptions.split(',').map(s => s.trim()) : f.options
        };
      }
      return f;
    }));
    triggerNotification('Configuração do campo salva!', 'success');
  };

  // Submit dynamic registration form
  const submitNewRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate CPF fields
    const cpfFields = formFields.filter(f => f.type === 'cpf');
    for (const field of cpfFields) {
      const val = dynamicFormInput[field.id];
      if (field.required || (val && val.trim() !== '')) {
        if (!val || !validateCPF(val)) {
          triggerNotification(`O campo "${field.label}" possui um CPF inválido!`, 'error');
          return;
        }
      }
    }
    
    // Primary field: 'Nome Completo'
    const nameField = formFields.find(f => f.id === 'f1') || formFields[0];
    const nameValue = dynamicFormInput[nameField?.id] || dynamicFormInput['f1'] || 'Membro Anônimo';

    // Find target leader metadata
    const selectedLeaderObj = leaders.find(l => l.id === newRegistrationLeader) || leaders[0];

    const newReg: Registration = {
      id: 'reg_' + Date.now(),
      name: nameValue,
      category: newRegistrationCategory,
      leaderId: selectedLeaderObj.id,
      leaderName: selectedLeaderObj.name,
      date: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      ...dynamicFormInput
    };

    // Increment leader registrations count
    const updatedLeaders = leaders.map(l => l.id === selectedLeaderObj.id ? { ...l, registrationCount: l.registrationCount + 1 } : l);
    setLeaders(updatedLeaders);
    setRegistrations([newReg, ...registrations]);

    // Supabase DB Sync
    if (isSupabaseConnected) {
      upsertRegistration(newReg).catch(console.error);
      const updatedLeaderObj = updatedLeaders.find(l => l.id === selectedLeaderObj.id);
      if (updatedLeaderObj) {
        upsertLeader(updatedLeaderObj).catch(console.error);
      }
    }
    
    // Clear dynamic inputs
    setDynamicFormInput({});
    setShowAddRegistrationModal(false);
    triggerNotification(`Cadastro de "${nameValue}" realizado com sucesso!`, 'success');
  };

  // Export spreadsheet / PDF utilities
  const handleExport = async (format: 'Excel' | 'PDF' | 'CSV') => {
    // Current date format dd-mm-yyyy
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const totalCount = registrations.length;
    const filteredCount = filteredRegistrations.length;

    // Filter dynamic form fields to get custom data columns
    const dynamicFields = formFields.filter(f => f.id !== 'f1' && f.type !== 'h2' && f.type !== 'p');

    const headers = [
      'Nome Completo',
      'Liderança Associada',
      'Categoria Cadastrada',
      'Período de Entrada',
      ...dynamicFields.map(f => f.label)
    ];

    const rows = filteredRegistrations.map(reg => {
      return [
        reg.name || '',
        reg.leaderName || '',
        reg.category || '',
        reg.date || '',
        ...dynamicFields.map(f => reg[f.id] !== undefined && reg[f.id] !== null ? String(reg[f.id]) : '')
      ];
    });

    if (format === 'Excel') {
      triggerNotification('Preparando arquivo de exportação em formato Excel...', 'info');

      // Calculate percentages for categories with count > 0
      const categoriesTotal = categoriesWithCount.reduce((sum, c) => sum + c.count, 0) || filteredCount || 1;
      const categoriesText = categoriesWithCount
        .filter(c => c.count > 0)
        .map(c => {
          const pct = ((c.count / categoriesTotal) * 100).toFixed(1);
          return `${c.category}: ${c.count} (${pct}%)`;
        }).join('  |  ');

      // Calculate percentages for regions with count > 0
      const regionsTotal = regionsWithCount.reduce((sum, r) => sum + r.count, 0) || filteredCount || 1;
      const regionsText = regionsWithCount
        .filter(r => r.count > 0)
        .map(r => {
          const pct = ((r.count / regionsTotal) * 100).toFixed(1);
          return `${r.region}: ${r.count} (${pct}%)`;
        }).join('  |  ');

      // Prepare HTML Spreadsheet structured data for Excel
      let htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
      htmlContent += `<head>`;
      htmlContent += `<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">`;
      htmlContent += `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Cadastros</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`;
      htmlContent += `<style>`;
      htmlContent += `table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }`;
      htmlContent += `td { border: 0.5pt solid #eceef0; padding: 6px 12px; font-size: 11pt; color: #191c1e; }`;
      htmlContent += `th { border: 0.5pt solid #eceef0; background-color: #f2f4f6; font-weight: bold; font-size: 11pt; text-align: left; padding: 8px 12px; color: #464555; }`;
      htmlContent += `.title { font-size: 16pt; font-weight: bold; color: #181445; }`;
      htmlContent += `.metric { font-weight: bold; font-size: 11pt; color: #3525cd; }`;
      htmlContent += `.label { font-size: 11pt; color: #777587; }`;
      htmlContent += `</style>`;
      htmlContent += `</head>`;
      htmlContent += `<body>`;
      htmlContent += `<table>`;
      
      // Document Metadata Headings
      htmlContent += `<tr><td colspan="${headers.length}" class="title" style="border:none;">Relatório de Cadastros - Ana Carolina</td></tr>`;
      htmlContent += `<tr><td colspan="${headers.length}" class="label" style="border:none;">Data do Relatório: <b>${formattedDate}</b></td></tr>`;
      htmlContent += `<tr><td colspan="${headers.length}" class="label" style="border:none;">Total Geral de Cadastros: <span class="metric">${totalCount}</span></td></tr>`;
      htmlContent += `<tr><td colspan="${headers.length}" class="label" style="border:none;">Total de Cadastros Filtrados: <span class="metric">${filteredCount}</span></td></tr>`;
      htmlContent += `<tr><td colspan="${headers.length}" class="label" style="border:none;">Distribuição por Categoria: <span class="metric">${categoriesText || 'Nenhum'}</span></td></tr>`;
      htmlContent += `<tr><td colspan="${headers.length}" class="label" style="border:none;">Distribuição por Região: <span class="metric">${regionsText || 'Nenhum'}</span></td></tr>`;
      htmlContent += `<tr><td colspan="${headers.length}" style="border:none; height:15px;"></td></tr>`;
      
      // Header values
      htmlContent += `<tr>`;
      headers.forEach(h => {
        htmlContent += `<th>${h}</th>`;
      });
      htmlContent += `</tr>`;
      
      // Value Rows
      rows.forEach(r => {
        htmlContent += `<tr>`;
        r.forEach(val => {
          const escapedVal = String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          htmlContent += `<td>${escapedVal}</td>`;
        });
        htmlContent += `</tr>`;
      });
      
      htmlContent += `</table>`;
      htmlContent += `</body>`;
      htmlContent += `</html>`;

      // Prepend UTF-8 BOM byte order mark
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Relatório de Cadastros - Ana Carolina ${formattedDate}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerNotification(`Planilha de Excel baixada com sucesso!`, 'success');

    } else if (format === 'CSV') {
      triggerNotification('Preparando arquivo de exportação em formato CSV...', 'info');

      // Calculate percentages for CSV metadata
      const categoriesTotal = categoriesWithCount.reduce((sum, c) => sum + c.count, 0) || filteredCount || 1;
      const categoriesText = categoriesWithCount
        .filter(c => c.count > 0)
        .map(c => {
          const pct = ((c.count / categoriesTotal) * 100).toFixed(1);
          return `${c.category}: ${c.count} (${pct}%)`;
        }).join('  |  ');

      const regionsTotal = regionsWithCount.reduce((sum, r) => sum + r.count, 0) || filteredCount || 1;
      const regionsText = regionsWithCount
        .filter(r => r.count > 0)
        .map(r => {
          const pct = ((r.count / regionsTotal) * 100).toFixed(1);
          return `${r.region}: ${r.count} (${pct}%)`;
        }).join('  |  ');

      // CSV needs semicolon as field separator for Excel compatibility in Portuguese
      let csvContent = `Relatório de Cadastros - Ana Carolina\r\n`;
      csvContent += `Data do Relatório;${formattedDate}\r\n`;
      csvContent += `Total Geral de Cadastros;${totalCount}\r\n`;
      csvContent += `Total de Cadastros Filtrados;${filteredCount}\r\n`;
      csvContent += `Distribuição por Categoria;${categoriesText || 'Nenhum'}\r\n`;
      csvContent += `Distribuição por Região;${regionsText || 'Nenhum'}\r\n\r\n`;

      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\r\n';
      
      rows.forEach(r => {
        csvContent += r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\r\n';
      });

      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Relatório de Cadastros - Ana Carolina ${formattedDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerNotification(`Arquivo CSV baixado com sucesso!`, 'success');

    } else if (format === 'PDF') {
      triggerNotification('Preparando a geração do relatório em PDF...', 'info');

      // Sub-calculations for PDF charts
      const getDailyData = () => {
        const points = [];
        const currentNow = new Date();
        
        for (let i = 14; i >= 0; i--) {
          const d = new Date(currentNow);
          d.setDate(currentNow.getDate() - i);
          const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          
          const matches = registrations.filter(r => {
            if (!r.createdAt) return false;
            const regDate = new Date(r.createdAt);
            const matchesLeader = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
            const matchesCategory = filterCategory === 'Todas as Categorias' || r.category === filterCategory;
            
            let matchesGlobalDate = true;
            if (filterStartDate) {
              const fStart = new Date(filterStartDate + 'T00:00:00');
              if (regDate < fStart) matchesGlobalDate = false;
            }
            if (filterEndDate) {
              const fEnd = new Date(filterEndDate + 'T23:59:59');
              if (regDate > fEnd) matchesGlobalDate = false;
            }

            const matchesInterval = regDate.getDate() === d.getDate() &&
                                    regDate.getMonth() === d.getMonth() &&
                                    regDate.getFullYear() === d.getFullYear();
            return matchesLeader && matchesCategory && matchesGlobalDate && matchesInterval;
          }).length;
          
          points.push({
            label: dayLabel,
            count: matches
          });
        }
        return points;
      };

      const getWeeklyData = () => {
        const points = [];
        const currentNow = new Date();
        
        for (let i = 7; i >= 0; i--) {
          const start = new Date(currentNow);
          start.setDate(currentNow.getDate() - (i + 1) * 7);
          const end = new Date(currentNow);
          end.setDate(currentNow.getDate() - i * 7);
          
          const label = i === 0 ? 'S-Atual' : `S-${i}`;
          
          const matches = registrations.filter(r => {
            if (!r.createdAt) return false;
            const regDate = new Date(r.createdAt);
            const matchesLeader = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
            const matchesCategory = filterCategory === 'Todas as Categorias' || r.category === filterCategory;
            
            let matchesGlobalDate = true;
            if (filterStartDate) {
              const fStart = new Date(filterStartDate + 'T00:00:00');
              if (regDate < fStart) matchesGlobalDate = false;
            }
            if (filterEndDate) {
              const fEnd = new Date(filterEndDate + 'T23:59:59');
              if (regDate > fEnd) matchesGlobalDate = false;
            }

            const matchesInterval = regDate >= start && regDate <= end;
            return matchesLeader && matchesCategory && matchesGlobalDate && matchesInterval;
          }).length;
          
          points.push({
            label,
            count: matches
          });
        }
        return points;
      };

      const getMonthlyData = () => {
        const points = [];
        const currentNow = new Date();
        const monthsAbbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        for (let i = 11; i >= 0; i--) {
          const d = new Date(currentNow.getFullYear(), currentNow.getMonth() - i, 1);
          const monthLabel = monthsAbbrev[d.getMonth()] + '/' + String(d.getFullYear()).substring(2);
          
          const matches = registrations.filter(r => {
            if (!r.createdAt) return false;
            const regDate = new Date(r.createdAt);
            const matchesLeader = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
            const matchesCategory = filterCategory === 'Todas as Categorias' || r.category === filterCategory;
            
            let matchesGlobalDate = true;
            if (filterStartDate) {
              const fStart = new Date(filterStartDate + 'T00:00:00');
              if (regDate < fStart) matchesGlobalDate = false;
            }
            if (filterEndDate) {
              const fEnd = new Date(filterEndDate + 'T23:59:59');
              if (regDate > fEnd) matchesGlobalDate = false;
            }

            const matchesInterval = regDate.getMonth() === d.getMonth() && regDate.getFullYear() === d.getFullYear();
            return matchesLeader && matchesCategory && matchesGlobalDate && matchesInterval;
          }).length;
          
          points.push({
            label: monthLabel,
            count: matches
          });
        }
        return points;
      };

      const buildSvgLineChart = (points: { label: string; count: number }[], title: string, subtitle: string) => {
        const wVal = 720;
        const hVal = 210;
        const padLeft = 40;
        const padRight = 30;
        const padTop = 25;
        const padBottom = 35;
        
        const activeW = wVal - padLeft - padRight;
        const activeH = hVal - padTop - padBottom;
        
        const maxVal = Math.max(...points.map(p => p.count), 1);
        
        const pointsPositions = points.map((p, index) => {
          const x = padLeft + (index * (activeW / (points.length - 1)));
          const y = (hVal - padBottom) - ((p.count / maxVal) * activeH);
          return { x, y, label: p.label, count: p.count };
        });
        
        let pathD = '';
        pointsPositions.forEach((curr, index) => {
          pathD += index === 0 ? `M ${curr.x} ${curr.y}` : ` L ${curr.x} ${curr.y}`;
        });

        // Generate grid line tags
        let gridLinesHtml = '';
        [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
          const yLine = padTop + (activeH * ratio);
          gridLinesHtml += `<line x1="${padLeft}" y1="${yLine}" x2="${wVal - padRight}" y2="${yLine}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3"/>`;
        });

        // Generate axial and value indicators
        let labelsHtml = '';
        pointsPositions.forEach((p, i) => {
          const skipLabel = points.length > 10 && i % 2 !== 0 && i !== points.length - 1;
          if (!skipLabel) {
            labelsHtml += `
              <text x="${p.x}" y="${hVal - 10}" text-anchor="middle" fill="#64748b" style="font-size:10px; font-family:Arial, sans-serif; font-weight:700;">${p.label}</text>
            `;
          }
          const skipValue = points.length > 10 && i % 2 !== 0;
          if (!skipValue) {
            labelsHtml += `
              <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" fill="#1e293b" style="font-size:9px; font-family:Arial, sans-serif; font-weight:800;">${p.count}</text>
              <circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="#3525cd" stroke-width="2" />
            `;
          }
        });

        return `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif;">
            <div style="margin-bottom: 12px;">
              <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif; line-height: 1.2;">${title}</h4>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b; font-family: Arial, sans-serif; line-height: 1.2;">${subtitle}</p>
            </div>
            <svg viewBox="0 0 ${wVal} ${hVal}" style="width: 100%; height: auto; overflow: visible;">
              ${gridLinesHtml}
              ${pathD ? `<path d="${pathD}" fill="none" stroke="#3525cd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
              ${labelsHtml}
            </svg>
          </div>
        `;
      };

      const buildSvgPieChart = (data: { label: string; count: number }[], total: number, title: string) => {
        const colors = ['#3525cd', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#06b6d4'];
        let accumulatedPercent = 0;
        let svgCircles = '';

        data.forEach((item, idx) => {
          const percent = (item.count / (total || 1)) * 100;
          const dashArray = `${percent * 1.885} 188.5`;
          const dashOffset = -(accumulatedPercent * 1.885);
          accumulatedPercent += percent;
          const color = colors[idx % colors.length];

          svgCircles += `
            <circle
              cx="50"
              cy="50"
              r="30"
              fill="transparent"
              stroke="${color}"
              stroke-width="10"
              stroke-dasharray="${dashArray}"
              stroke-dashoffset="${dashOffset}"
            />
          `;
        });

        let legendRowsHtml = '';
        data.forEach((item, idx) => {
          const percent = total > 0 ? (item.count / total) * 100 : 0;
          const color = colors[idx % colors.length];
          legendRowsHtml += `
            <tr style="height: auto;">
              <td style="width: 12px; padding: 5px 0; text-align: center; vertical-align: middle;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; display: block; margin: 0 auto;"></span>
              </td>
              <td style="padding: 5px 0 5px 8px; vertical-align: middle; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #334155;">
                ${item.label}
              </td>
              <td style="width: 85px; padding: 5px 0; text-align: right; vertical-align: middle; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #1e293b; white-space: nowrap;">
                ${item.count} (${percent.toFixed(0)}%)
              </td>
            </tr>
          `;
        });

        return `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: block; box-sizing: border-box; min-height: 160px; font-family: Arial, Helvetica, sans-serif;">
            <h4 style="margin: 0; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">${title}</h4>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed;">
              <tr>
                <td style="width: 110px; vertical-align: middle; padding: 0;">
                  <div style="position: relative; width: 100px; height: 100px;">
                    <svg style="width: 100%; height: 100%; transform: rotate(-90deg);" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f1f5f9" stroke-width="10" />
                      ${svgCircles}
                      <circle cx="50" cy="50" r="25" fill="#ffffff" />
                    </svg>
                    <div style="position: absolute; top: 32px; left: 0; width: 100%; text-align: center; font-family: Arial, sans-serif;">
                      <span style="font-size: 15px; font-weight: 800; color: #1e293b; line-height: 1; display: block;">${total}</span>
                      <span style="font-size: 6px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; line-height: 1; display: block;">Total</span>
                    </div>
                  </div>
                </td>
                <td style="vertical-align: middle; padding-left: 10px;">
                  <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <tbody>
                      ${legendRowsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `;
      };

      const buildLeadershipBarChart = (data: { name: string; count: number }[]) => {
        const maxCount = Math.max(...data.map(d => d.count), 1);
        let barsHtml = '<table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 15px; font-family: Arial, Helvetica, sans-serif;">';

        data.forEach((l) => {
          const widthPct = (l.count / maxCount) * 100;
          barsHtml += `
            <tr style="height: 45px;">
              <!-- Name & Progress Bar -->
              <td style="vertical-align: middle; padding: 0 10px 0 0;">
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <tr>
                    <td style="padding: 0 0 4px 0; text-align: left; vertical-align: bottom;">
                      <span style="font-weight: bold; color: #1e293b; font-size: 12px; display: block; font-family: Arial, sans-serif;">${l.name}</span>
                    </td>
                    <td style="width: 110px; padding: 0 0 4px 0; text-align: right; vertical-align: bottom;">
                      <span style="font-weight: bold; color: #3525cd; font-family: Arial, sans-serif; font-size: 11px; display: block;">${l.count} ${l.count === 1 ? 'cadastro' : 'cadastros'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 2px 0 0 0; vertical-align: top;">
                      <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; position: relative; display: block; box-sizing: border-box;">
                        <div style="width: ${widthPct}%; height: 8px; background: #3525cd; border-radius: 4px; position: absolute; left: 0; top: 0;"></div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        });

        barsHtml += '</table>';

        return `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; width: 100%; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">Número de Cadastros por Liderança</h4>
            <p style="margin: 2px 0 15px 0; font-size: 10px; color: #64748b; line-height: 1.2;">Visualização e comparação direta do volume de captação de campo entre lideranças</p>
            ${barsHtml}
          </div>
        `;
      };

      const buildLeaderStandingsTable = (leadersList: typeof leaders, regsList: typeof registrations) => {
        let tableRows = '';
        // Top 5 leaders to prevent page overflow
        const sortedLeaders = [...leadersList].sort((a,b) => {
          const aCount = regsList.filter(r => r.leaderId === a.id || r.leaderName === a.name).length;
          const bCount = regsList.filter(r => r.leaderId === b.id || r.leaderName === b.name).length;
          return bCount - aCount;
        }).slice(0, 5);

        sortedLeaders.forEach(l => {
          const activeCount = regsList.filter(r => r.leaderId === l.id || r.leaderName === l.name).length;
          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-size: 11px; color: #1e293b; font-weight: bold; vertical-align: middle; font-family: Arial, sans-serif;">${l.name}</td>
              <td style="padding: 10px; font-size: 11px; color: #64748b; vertical-align: middle; font-family: Arial, sans-serif;">${l.email}</td>
              <td style="padding: 10px; font-size: 11px; vertical-align: middle;">
                <span style="color: ${l.status === 'Ativo' ? '#166534' : '#991b1b'}; font-weight: bold; font-family: Arial, sans-serif; display: inline-block;">
                  ${l.status}
                </span>
              </td>
              <td style="padding: 10px; font-size: 11px; font-weight: bold; color: #1e293b; text-align: right; font-family: Arial, sans-serif; vertical-align: middle;">${activeCount}</td>
            </tr>
          `;
        });

        return `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; width: 100%; box-sizing: border-box; margin-top: 20px; font-family: Arial, Helvetica, sans-serif;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">Quadro Geral de Lideranças</h4>
            <table style="width: 100%; border-collapse: collapse; text-align: left; table-layout: fixed;">
              <thead>
                <tr style="border-bottom: 1.5px solid #dedeff; background: #f8fafc;">
                  <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">Liderança</th>
                  <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">E-mail</th>
                  <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">Status</th>
                  <th style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right; font-family: Arial, sans-serif;">Total Cadastros</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `;
      };

      // Retrieve computed dynamic points
      const dailyPoints = getDailyData();
      const weeklyPoints = getWeeklyData();
      const monthlyPoints = getMonthlyData();

      const categoryDataForPie = categoriesWithCount.map(c => ({ label: c.category, count: c.count }));
      const totalCategory = categoryDataForPie.reduce((acc, c) => acc + c.count, 0);

      const regionDataForPie = regionsWithCount.map(r => ({ label: r.region, count: r.count }));
      const totalRegion = regionDataForPie.reduce((acc, r) => acc + r.count, 0);

      const leadersDataForBar = leaders.map(l => {
        const cnt = registrations.filter(r => r.leaderId === l.id || r.leaderName === l.name).length;
        return { name: l.name, count: cnt };
      }).sort((a,b) => b.count - a.count).slice(0, 6);

      const dailyAvg = dailyPoints.reduce((sum, item) => sum + item.count, 0) / Math.max(1, dailyPoints.length);

      // Create a hidden container for exporting
      const container = document.createElement('div');
      container.id = 'pdf-export-container';
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.style.zIndex = '-9999';

      const page1Html = `
        <div id="pdf-p1" style="width: 800px; height: 1120px; background: #ffffff; padding: 40px; box-sizing: border-box; display: block; font-family: Arial, Helvetica, sans-serif;">
          <div style="height: 1010px; box-sizing: border-box; display: block;">
            <table style="width: 100%; border-collapse: collapse; background: #181445; border-radius: 12px; margin-bottom: 25px; table-layout: fixed; box-sizing: border-box;">
              <tr>
                <td style="padding: 25px; text-align: left; vertical-align: middle;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; color: #ffffff; font-family: Arial, sans-serif; line-height: 1.2;">Relatório Consolidado de Cadastros</h1>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8; font-weight: 500; font-family: Arial, sans-serif; line-height: 1.2;">Ana Carolina • Central de Relatórios de Campo</p>
                </td>
                <td style="width: 150px; padding: 25px; text-align: right; vertical-align: middle;">
                  <div style="font-size: 10px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif; line-height: 1.2;">Emissão</div>
                  <div style="font-size: 13px; font-weight: 800; margin-top: 2px; color: #ffffff; font-family: Arial, sans-serif; line-height: 1.2;">${formattedDate}</div>
                </td>
              </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed;">
              <tr>
                <td style="width: 25%; padding-right: 15px; vertical-align: top; box-sizing: border-box;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-sizing: border-box; min-height: 85px; font-family: Arial, sans-serif;">
                    <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Total de Cadastros</span>
                    <span style="font-size: 22px; font-weight: bold; color: #1e293b; display: block;">${registrations.length}</span>
                    <span style="font-size: 9px; color: #166534; font-weight: bold; display: block; margin-top: 5px;">✔ Ativos no Sistema</span>
                  </div>
                </td>
                <td style="width: 25%; padding-right: 15px; vertical-align: top; box-sizing: border-box;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-sizing: border-box; min-height: 85px; font-family: Arial, sans-serif;">
                    <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Lideranças Ativas</span>
                    <span style="font-size: 22px; font-weight: bold; color: #3525cd; display: block;">${leaders.length}</span>
                    <span style="font-size: 9px; color: #6366f1; font-weight: bold; display: block; margin-top: 5px;">&nbsp;</span>
                  </div>
                </td>
                <td style="width: 25%; padding-right: 15px; vertical-align: top; box-sizing: border-box;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-sizing: border-box; min-height: 85px; font-family: Arial, sans-serif;">
                    <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Média Diária</span>
                    <span style="font-size: 22px; font-weight: bold; color: #475569; display: block;">${Math.round(dailyAvg)}</span>
                    <span style="font-size: 9px; color: #475569; font-weight: bold; display: block; margin-top: 5px;">cadastros / dia</span>
                  </div>
                </td>
                <td style="width: 25%; vertical-align: top; box-sizing: border-box;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-sizing: border-box; min-height: 85px; font-family: Arial, sans-serif;">
                    <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Liderança Destaque</span>
                    <span style="font-size: 13px; font-weight: bold; color: #ca8a04; display: block; min-height: 24px; vertical-align: middle;">
                      ${outstandingLeaderData.leader?.name || '---'}
                    </span>
                    <span style="font-size: 9px; color: #ca8a04; font-weight: bold; display: block; margin-top: 5px;">🏆 Maior Desempenho</span>
                  </div>
                </td>
              </tr>
            </table>

            ${buildSvgLineChart(dailyPoints, 'Desempenho Diário (Últimos 15 Dias)', 'Histórico de cadastros captados diariamente em campo nas últimas duas semanas')}
            ${buildSvgLineChart(weeklyPoints, 'Desempenho Semanal (Últimas 8 Semanas)', 'Análise agregada semanal do progresso e volume de cadastrados coletados')}
          </div>

          <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #f1f5f9; padding-top: 15px; table-layout: fixed; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif;">
            <tr>
              <td style="padding-top: 15px; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: left;">Ana Carolina • Central Administrativa de Lideranças</td>
              <td style="padding-top: 15px; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right;">Página 1 de 3</td>
            </tr>
          </table>
        </div>
      `;

      const page2Html = `
        <div id="pdf-p2" style="width: 800px; height: 1120px; background: #ffffff; padding: 40px; box-sizing: border-box; display: block; font-family: Arial, Helvetica, sans-serif;">
          <div style="height: 1010px; box-sizing: border-box; display: block;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; box-sizing: border-box;">
              <tr>
                <td style="padding-bottom: 15px; text-align: left; vertical-align: middle; border-bottom: 2px solid #e2e8f0;">
                  <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">Detalhamento Demográfico & Períodos Longos</h2>
                  <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-family: Arial, sans-serif;">Relatório de Desempenho Regional e de Categorias</p>
                </td>
                <td style="width: 120px; padding-bottom: 15px; text-align: right; vertical-align: middle; border-bottom: 2px solid #e2e8f0;">
                  <span style="font-size: 10.5px; font-weight: bold; color: #3525cd; font-family: Arial, sans-serif; display: inline-block; vertical-align: middle;">AUDITORIA</span>
                </td>
              </tr>
            </table>

            ${buildSvgLineChart(monthlyPoints, 'Desempenho Mensal (Últimos 12 Meses)', 'Histórico de longo prazo com representatividade mensal de cadastros coletados de campo')}

            <table style="width: 100%; border-collapse: collapse; margin-top: 25px; table-layout: fixed;">
              <tr>
                <td style="width: 50%; padding-right: 10px; vertical-align: top; box-sizing: border-box;">
                  ${buildSvgPieChart(categoryDataForPie, totalCategory, 'Participação por Categoria')}
                </td>
                <td style="width: 50%; padding-left: 10px; vertical-align: top; box-sizing: border-box;">
                  ${buildSvgPieChart(regionDataForPie, totalRegion, 'Distribuição por Região')}
                </td>
              </tr>
            </table>
          </div>

          <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #f1f5f9; padding-top: 15px; table-layout: fixed; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif;">
            <tr>
              <td style="padding-top: 15px; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: left;">Ana Carolina • Central Administrativa de Lideranças</td>
              <td style="padding-top: 15px; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right;">Página 2 de 3</td>
            </tr>
          </table>
        </div>
      `;

      const page3Html = `
        <div id="pdf-p3" style="width: 800px; height: 1120px; background: #ffffff; padding: 40px; box-sizing: border-box; display: block; font-family: Arial, Helvetica, sans-serif;">
          <div style="height: 1010px; box-sizing: border-box; display: block;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; box-sizing: border-box;">
              <tr>
                <td style="padding-bottom: 15px; text-align: left; vertical-align: middle; border-bottom: 2px solid #e2e8f0;">
                  <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">Desempenho Detalhado por Liderança</h2>
                  <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-family: Arial, sans-serif;">Mapeamento individual e ranqueamento de produtividade coletora</p>
                </td>
                <td style="width: 120px; padding-bottom: 15px; text-align: right; vertical-align: middle; border-bottom: 2px solid #e2e8f0;">
                  <span style="font-size: 10.5px; font-weight: bold; color: #10b981; font-family: Arial, sans-serif; display: inline-block; vertical-align: middle;">LIDERANÇAS</span>
                </td>
              </tr>
            </table>

            ${buildLeadershipBarChart(leadersDataForBar)}
            ${buildLeaderStandingsTable(leaders, registrations)}
          </div>

          <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #f1f5f9; padding-top: 15px; table-layout: fixed; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif;">
            <tr>
              <td style="padding-top: 15px; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: left;">Ana Carolina • Central Administrativa de Lideranças</td>
              <td style="padding-top: 15px; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right;">Página 3 de 3</td>
            </tr>
          </table>
        </div>
      `;

      container.innerHTML = `
        <div style="background: #e2e8f0; padding: 0; margin: 0; display: block;">
          ${page1Html}
          ${page2Html}
          ${page3Html}
        </div>
      `;

      document.body.appendChild(container);

      try {
        const pdf = new jsPDF('p', 'mm', 'a4', true);
        const options = {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        };

        const p1Element = document.getElementById('pdf-p1');
        const p2Element = document.getElementById('pdf-p2');
        const p3Element = document.getElementById('pdf-p3');

        if (p1Element && p2Element && p3Element) {
          const p1Canvas = await html2canvas(p1Element, options);
          const p1Img = p1Canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(p1Img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

          const p2Canvas = await html2canvas(p2Element, options);
          const p2Img = p2Canvas.toDataURL('image/jpeg', 0.95);
          pdf.addPage();
          pdf.addImage(p2Img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

          const p3Canvas = await html2canvas(p3Element, options);
          const p3Img = p3Canvas.toDataURL('image/jpeg', 0.95);
          pdf.addPage();
          pdf.addImage(p3Img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

          // Save PDF with correct pattern
          pdf.save(`Relatório de Cadastros - Ana Carolina ${formattedDate}.pdf`);
          triggerNotification(`Relatório PDF exportado com sucesso!`, 'success');
        } else {
          throw new Error('Elements not found in PDF compiler.');
        }
      } catch (err) {
        console.error('PDF generation error:', err);
        triggerNotification('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.', 'error');
      } finally {
        document.body.removeChild(container);
      }
    }
  };

  // Delete registration
  const handleDeleteRegistration = (id: string, name: string) => {
    setRegistrationToDelete({ id, name });
  };

  const confirmDeleteRegistration = () => {
    if (registrationToDelete) {
      setRegistrations(registrations.filter(r => r.id !== registrationToDelete.id));
      
      if (isSupabaseConnected) {
        deleteRegistrationFromDB(registrationToDelete.id).catch(console.error);
        const deletedReg = registrations.find(r => r.id === registrationToDelete.id);
        if (deletedReg) {
          const leaderObj = leaders.find(l => l.id === deletedReg.leaderId);
          if (leaderObj) {
            const updatedCount = Math.max(0, leaderObj.registrationCount - 1);
            setLeaders(leaders.map(l => l.id === leaderObj.id ? { ...l, registrationCount: updatedCount } : l));
            upsertLeader({ ...leaderObj, registrationCount: updatedCount }).catch(console.error);
          }
        }
      }

      triggerNotification(`Cadastro de "${registrationToDelete.name}" foi excluído.`, 'info');
      setRegistrationToDelete(null);
    }
  };

  const handleViewRegistration = (reg: Registration) => {
    setViewingRegistration(reg);
  };

  const handleEditRegistrationClick = (reg: Registration) => {
    setEditingRegistration(reg);
    setEditRegName(reg.name);
    setEditRegLeaderId(reg.leaderId);
    setEditRegCategory(reg.category);
    
    const dynamicVals: Record<string, string> = {};
    formFields.forEach(f => {
      if (f.id !== 'f1' && f.type !== 'h2' && f.type !== 'p') {
        dynamicVals[f.id] = reg[f.id] !== undefined && reg[f.id] !== null ? String(reg[f.id]) : '';
      }
    });
    setEditRegDynamicFields(dynamicVals);
  };

  const handleSaveRegistrationEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRegName.trim()) {
      triggerNotification('O nome do cadastrado é obrigatório!', 'error');
      return;
    }

    // Validate CPF fields in edit mode
    const cpfFields = formFields.filter(f => f.type === 'cpf');
    for (const field of cpfFields) {
      const val = editRegDynamicFields[field.id];
      if (field.required || (val && val.trim() !== '')) {
        if (!val || !validateCPF(val)) {
          triggerNotification(`O campo "${field.label}" possui um CPF inválido!`, 'error');
          return;
        }
      }
    }

    const selectedLeaderObj = leaders.find(l => l.id === editRegLeaderId);
    if (!selectedLeaderObj) {
      triggerNotification('Liderança inválida.', 'error');
      return;
    }

    if (editingRegistration) {
      const updatedReg = {
        ...editingRegistration,
        ...editRegDynamicFields,
        name: editRegName,
        leaderId: selectedLeaderObj.id,
        leaderName: selectedLeaderObj.name,
        category: editRegCategory
      };
      setRegistrations(registrations.map(r => r.id === editingRegistration.id ? updatedReg : r));

      // Adjust leader counts if leader registration changed
      let updatedLeaders = [...leaders];
      if (editingRegistration.leaderId !== selectedLeaderObj.id) {
        updatedLeaders = leaders.map(l => {
          if (l.id === editingRegistration.leaderId) {
            return { ...l, registrationCount: Math.max(0, l.registrationCount - 1) };
          }
          if (l.id === selectedLeaderObj.id) {
            return { ...l, registrationCount: l.registrationCount + 1 };
          }
          return l;
        });
        setLeaders(updatedLeaders);
      }

      // Supabase DB Sync
      if (isSupabaseConnected) {
        upsertRegistration(updatedReg).catch(console.error);
        if (editingRegistration.leaderId !== selectedLeaderObj.id) {
          const oldLeader = updatedLeaders.find(l => l.id === editingRegistration.leaderId);
          const newLeader = updatedLeaders.find(l => l.id === selectedLeaderObj.id);
          if (oldLeader) upsertLeader(oldLeader).catch(console.error);
          if (newLeader) upsertLeader(newLeader).catch(console.error);
        }
      }

      triggerNotification(`Cadastro de "${editRegName}" atualizado com sucesso!`, 'success');
      setEditingRegistration(null);
    }
  };

  const currentLeaderLink = profile.name === 'Ana Carolina Oliveira' || profile.name === 'Ana Carolina'
    ? 'cadastros.com/ana-carolina-lider'
    : `cadastros.com/${profile.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')}-lider`;

  const handleDownloadPersonalQR = async (text: string, filename: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        margin: 2,
        width: 600,
        color: {
          dark: '#181445',
          light: '#ffffff'
        }
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerNotification('QR Code de alta definição baixado com sucesso!', 'success');
    } catch (error) {
      console.error('Error generating QR for download', error);
      triggerNotification('Erro ao gerar imagem para download.', 'error');
    }
  };

  // Add / Edit Leaders
  const handleAddOrEditLeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaderName.trim() || !newLeaderEmail.trim()) {
      triggerNotification('Nome e Email são obrigatórios!', 'error');
      return;
    }

    if (!newLeaderCPF.trim()) {
      triggerNotification('CPF é um campo obrigatório para a liderança!', 'error');
      return;
    }

    if (!validateCPF(newLeaderCPF)) {
      triggerNotification('CPF inválido! Por favor, insira um número de CPF válido.', 'error');
      return;
    }

    if (editingLeader) {
      const updatedLeader = {
        ...editingLeader,
        name: newLeaderName,
        email: newLeaderEmail,
        phone: newLeaderPhone,
        cpf: newLeaderCPF
      };
      setLeaders(leaders.map(l => l.id === editingLeader.id ? updatedLeader : l));
      
      // Save all registrations registered under this leader's old name
      const updatedRegs = registrations.map(r => r.leaderId === editingLeader.id ? { ...r, leaderName: newLeaderName } : r);
      setRegistrations(updatedRegs);

      // Supabase Sync
      if (isSupabaseConnected) {
        upsertLeader(updatedLeader).catch(console.error);
        const regsToUpdate = updatedRegs.filter(r => r.leaderId === editingLeader.id);
        for (const reg of regsToUpdate) {
          upsertRegistration(reg).catch(console.error);
        }
      }

      triggerNotification(`Informações da liderança "${newLeaderName}" atualizadas!`, 'success');
    } else {
      const newLeader: Leader = {
        id: 'leader_' + Date.now(),
        name: newLeaderName,
        email: newLeaderEmail,
        phone: newLeaderPhone || '(11) 90000-0000',
        cpf: newLeaderCPF,
        avatarUrl: `https://lh3.googleusercontent.com/aida-public/AB6AXuBqSqcWc2kJo5-jPOAsbeGIb73aG0i_QnKy9b-NmRm3CWjLDJj4hYwyMD3D8hoylJyWJr2TNTScNu6gweCSmnYvCLbCAlhNTQ2BMZE5YnNxIzMvoAZ2P0JNm0DXeAEmRBgegNC_W7C-vKE26uOQpcfSt52h0K4UZnWBTXokjMEBuZyJq8qoHxpEzIjbC78LKdoM5eTOIK9y-kzr0kb3cKL5aD46C_lP1tU9KHX7Uv7ixekHZh-ZryJEIwsri-E3rBGiMVgf5oCpXZOc`,
        registrationCount: 0,
        status: 'Ativo'
      };
      setLeaders([...leaders, newLeader]);

      // Supabase Sync
      if (isSupabaseConnected) {
        upsertLeader(newLeader).catch(console.error);
      }

      triggerNotification(`Nova liderança "${newLeaderName}" criada com sucesso.`, 'success');
    }

    // Reset inputs
    setNewLeaderName('');
    setNewLeaderEmail('');
    setNewLeaderPhone('');
    setNewLeaderCPF('');
    setEditingLeader(null);
    setShowAddLeaderModal(false);
  };

  const handleEditLeaderClick = (leader: Leader) => {
    setEditingLeader(leader);
    setNewLeaderName(leader.name);
    setNewLeaderEmail(leader.email);
    setNewLeaderPhone(leader.phone);
    setNewLeaderCPF(leader.cpf || '');
    setShowAddLeaderModal(true);
  };

  const handleDeleteLeader = (id: string, name: string) => {
    setLeaderToDelete({ id, name });
  };

  const confirmDeleteLeader = () => {
    if (leaderToDelete) {
      setLeaders(leaders.filter(l => l.id !== leaderToDelete.id));
      
      // Supabase Sync
      if (isSupabaseConnected) {
        deleteLeaderFromDB(leaderToDelete.id).catch(console.error);
      }

      triggerNotification(`Liderança "${leaderToDelete.name}" removida.`, 'info');
      setLeaderToDelete(null);
    }
  };

  const toggleLeaderStatus = (id: string) => {
    const updatedLeaders = leaders.map(l => {
      if (l.id === id) {
        const updated = { ...l, status: l.status === 'Ativo' ? 'Inativo' as const : 'Ativo' as const };
        if (isSupabaseConnected) {
          upsertLeader(updated).catch(console.error);
        }
        return updated;
      }
      return l;
    });
    setLeaders(updatedLeaders);
    triggerNotification(`Status alterado de forma bem sucedida.`, 'success');
  };

  // Profile Save Changes
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    triggerNotification('Atualizando dados de perfil corporativo...', 'info');
    if (isSupabaseConnected) {
      upsertProfile('p1', profile)
        .then(success => {
          if (success) {
            triggerNotification('Perfil corporativo sincronizado no Supabase!', 'success');
          } else {
            triggerNotification('Perfil corporativo salvo localmente!', 'success');
          }
        })
        .catch(err => {
          console.error(err);
          triggerNotification('Perfil salvo localmente.', 'success');
        });
    } else {
      setTimeout(() => {
        triggerNotification('Alterações de perfil salvas com sucesso localmente!', 'success');
      }, 500);
    }
  };

  // Change security password
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8) {
      triggerNotification('A nova senha deve possuir pelo menos 8 dígitos.', 'error');
      return;
    }
    if (newPass !== confirmNewPass) {
      triggerNotification('A confirmação da senha não corresponde.', 'error');
      return;
    }
    triggerNotification('Armazenando chaves de segurança...', 'info');
    setTimeout(() => {
      setNewPass('');
      setConfirmNewPass('');
      setCurrentPass('••••••••');
      triggerNotification('Senha redefinida com sucesso!', 'success');
    }, 1200);
  };

  // Generate copy-to-clipboard trigger
  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerNotification('Link exclusivo copiado com sucesso!', 'success');
  };

  // Dynamic values based on filters in Reports screen
  const filteredRegistrations = registrations.filter(r => {
    const query = searchQuery.toLowerCase().trim();
    const queryMatch = !query || r.name.toLowerCase().includes(query) || r.category.toLowerCase().includes(query) || r.leaderName.toLowerCase().includes(query);
    
    const leaderMatch = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
    const categoryMatch = filterCategory === 'Todas as Categorias' || r.category.includes(filterCategory);

    // Filter by Date period
    let dateMatch = true;
    if (r.createdAt && filterStartDate && filterEndDate) {
      try {
        const regDate = new Date(r.createdAt);
        const start = new Date(filterStartDate + 'T00:00:00');
        const end = new Date(filterEndDate + 'T23:59:59');
        dateMatch = regDate >= start && regDate <= end;
      } catch (err) {
        dateMatch = true;
      }
    }

    return queryMatch && leaderMatch && categoryMatch && dateMatch;
  });

  // KPI aggregates
  const totalCadastrosValue = registrations.length;
  const activeLeadersCount = leaders.filter(l => l.status === 'Ativo').length;
  const inactiveLeadersCount = leaders.filter(l => l.status === 'Inativo').length;
  const totalLeadsToday = registrations.filter(r => r.date.toLowerCase().includes('hoje') || r.date.includes(':')).length;

  // Dynamic Month count from registrations
  const totalLeadsThisMonth = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return registrations.filter(r => {
      if (!r.createdAt) return false;
      const d = new Date(r.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
  }, [registrations]);

  // Dynamic filtered month count for report metric
  const filteredLeadsThisMonth = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return filteredRegistrations.filter(r => {
      if (!r.createdAt) return false;
      const d = new Date(r.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
  }, [filteredRegistrations]);

  // Dynamic Conversion Rate based on Completed Registrations and Active Leaders
  const taxaConversao = useMemo(() => {
    const activeLeaders = leaders.filter(l => l.status === 'Ativo');
    if (activeLeaders.length === 0) return 0;
    
    // Calculate how many active leaders have at least one registration in filtered list
    const leadersWithRegistrations = activeLeaders.filter(l => {
      return filteredRegistrations.some(r => r.leaderId === l.id || r.leaderName === l.name);
    }).length;

    return Number(((leadersWithRegistrations / activeLeaders.length) * 100).toFixed(1));
  }, [filteredRegistrations, leaders]);

  // Outstanding leader of the filtered period calculation
  const outstandingLeaderData = (() => {
    if (filteredRegistrations.length === 0 || leaders.length === 0) {
      return {
        leader: leaders[0] || null,
        count: 0
      };
    }

    const counts: Record<string, number> = {};
    filteredRegistrations.forEach(r => {
      const id = r.leaderId;
      if (id) {
        counts[id] = (counts[id] || 0) + 1;
      }
    });

    let topLeaderId = '';
    let maxCount = -1;

    Object.entries(counts).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topLeaderId = id;
      }
    });

    const topLeader = leaders.find(l => l.id === topLeaderId);
    return {
      leader: topLeader || leaders[0] || null,
      count: maxCount !== -1 ? maxCount : 0
    };
  })();

  // Dynamic performance data for line chart
  const performanceChartData = useMemo(() => {
    // Helper to calculate growth dynamically from points array
    const calculateGrowthValue = (pts: { label: string; count: number }[]) => {
      if (pts.length < 2) return '0%';
      const halfSize = Math.floor(pts.length / 2);
      const olderHalf = pts.slice(0, halfSize);
      const newerHalf = pts.slice(halfSize);
      
      const olderSum = olderHalf.reduce((sum, p) => sum + p.count, 0);
      const newerSum = newerHalf.reduce((sum, p) => sum + p.count, 0);
      
      if (olderSum === 0) {
        return newerSum > 0 ? '+100% vs período anterior' : '0% vs período anterior';
      }
      
      const pct = ((newerSum - olderSum) / olderSum) * 100;
      const formatted = pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
      return `${formatted} vs período anterior`;
    };

    if (performancePeriod === 'Diário') {
      const points = [];
      const now = new Date();
      // Build the last 15 days in chronological order (from 14 days ago to today)
      for (let i = 14; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        // Count actual registrations created on this exact day
        const matches = registrations.filter(r => {
          if (!r.createdAt) return false;
          const regDate = new Date(r.createdAt);
          const matchesLeader = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
          const matchesCategory = filterCategory === 'Todas as Categorias' || r.category === filterCategory;
          
          let matchesGlobalDate = true;
          if (filterStartDate) {
            const fStart = new Date(filterStartDate + 'T00:00:00');
            if (regDate < fStart) matchesGlobalDate = false;
          }
          if (filterEndDate) {
            const fEnd = new Date(filterEndDate + 'T23:59:59');
            if (regDate > fEnd) matchesGlobalDate = false;
          }

          const matchesInterval = regDate.getDate() === d.getDate() &&
                                  regDate.getMonth() === d.getMonth() &&
                                  regDate.getFullYear() === d.getFullYear();
          return matchesLeader && matchesCategory && matchesGlobalDate && matchesInterval;
        }).length;
        
        points.push({
          label: dayLabel,
          count: matches
        });
      }
      
      const sum = points.reduce((a, b) => a + b.count, 0);
      return {
        points,
        title: 'Desempenho Diário (15 Dias)',
        subtitle: 'Contabilização total de cadastros realizados nos últimos 15 dias',
        avg: (sum / points.length) < 1 ? `${(sum / points.length).toFixed(2)} cadastros/dia` : `${Math.round(sum / points.length)} cadastros/dia`,
        growth: calculateGrowthValue(points)
      };
    } else if (performancePeriod === 'Semanal') {
      const points = [];
      const now = new Date();
      // Build the last 8 weeks in chronological order
      for (let i = 7; i >= 0; i--) {
        // Range of days for this week
        const start = new Date(now);
        start.setDate(now.getDate() - (i + 1) * 7);
        const end = new Date(now);
        end.setDate(now.getDate() - i * 7);
        
        const label = i === 0 ? 'S-Atual' : `S-${i}`;
        
        const matches = registrations.filter(r => {
          if (!r.createdAt) return false;
          const regDate = new Date(r.createdAt);
          const matchesLeader = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
          const matchesCategory = filterCategory === 'Todas as Categorias' || r.category === filterCategory;
          
          let matchesGlobalDate = true;
          if (filterStartDate) {
            const fStart = new Date(filterStartDate + 'T00:00:00');
            if (regDate < fStart) matchesGlobalDate = false;
          }
          if (filterEndDate) {
            const fEnd = new Date(filterEndDate + 'T23:59:59');
            if (regDate > fEnd) matchesGlobalDate = false;
          }

          const matchesInterval = regDate >= start && regDate <= end;
          return matchesLeader && matchesCategory && matchesGlobalDate && matchesInterval;
        }).length;
        
        points.push({
          label,
          count: matches
        });
      }
      
      const sum = points.reduce((a, b) => a + b.count, 0);
      return {
        points,
        title: 'Desempenho Semanal (8 Semanas)',
        subtitle: 'Contabilização de cadastros de campo acumulados nas últimas 8 semanas',
        avg: (sum / points.length) < 1 ? `${(sum / points.length).toFixed(2)} cadastros/semana` : `${Math.round(sum / points.length)} cadastros/semana`,
        growth: calculateGrowthValue(points)
      };
    } else {
      const points = [];
      const now = new Date();
      const monthsAbbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      // Build the last 12 months in chronological order
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = monthsAbbrev[d.getMonth()] + '/' + String(d.getFullYear()).substring(2);
        
        const matches = registrations.filter(r => {
          if (!r.createdAt) return false;
          const regDate = new Date(r.createdAt);
          const matchesLeader = filterLeader === 'Todas as Lideranças' || r.leaderName === filterLeader;
          const matchesCategory = filterCategory === 'Todas as Categorias' || r.category === filterCategory;
          
          let matchesGlobalDate = true;
          if (filterStartDate) {
            const fStart = new Date(filterStartDate + 'T00:00:00');
            if (regDate < fStart) matchesGlobalDate = false;
          }
          if (filterEndDate) {
            const fEnd = new Date(filterEndDate + 'T23:59:59');
            if (regDate > fEnd) matchesGlobalDate = false;
          }

          const matchesInterval = regDate.getMonth() === d.getMonth() && regDate.getFullYear() === d.getFullYear();
          return matchesLeader && matchesCategory && matchesGlobalDate && matchesInterval;
        }).length;
        
        points.push({
          label: monthLabel,
          count: matches
        });
      }
      
      const sum = points.reduce((a, b) => a + b.count, 0);
      return {
        points,
        title: 'Desempenho Mensal (12 Meses)',
        subtitle: 'Contabilização de cadastros de campo acumulados nos últimos 12 meses',
        avg: (sum / points.length) < 1 ? `${(sum / points.length).toFixed(2)} cadastros/mês` : `${Math.round(sum / points.length)} cadastros/mês`,
        growth: calculateGrowthValue(points)
      };
    }
  }, [performancePeriod, registrations, filterLeader, filterCategory, filterStartDate, filterEndDate]);

  // Dynamic Categories calculation for Pie Chart
  const categoriesWithCount = useMemo(() => {
    const categoriesSet = new Set<string>();
    CATEGORIES_LIST.forEach(c => categoriesSet.add(c));
    formFields.forEach(f => {
      if (f.label.toLowerCase().includes('categoria') && f.options) {
        f.options.forEach(opt => categoriesSet.add(opt));
      }
    });
    registrations.forEach(r => {
      if (r.category) categoriesSet.add(r.category);
    });

    const counts: Record<string, number> = {};
    categoriesSet.forEach(cat => {
      counts[cat] = 0;
    });

    filteredRegistrations.forEach(r => {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
    });

    const list = Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .filter(item => item.count > 0);

    if (list.length === 0) {
      return Object.entries(counts).map(([category]) => ({ category, count: 0 }));
    }
    return list.sort((a, b) => b.count - a.count);
  }, [filteredRegistrations, registrations, formFields]);

  // Dynamic Regions calculation for Pie Chart
  const regionsWithCount = useMemo(() => {
    const regionField = formFields.find(f => 
      f.label.toLowerCase().includes('regiã') || 
      f.label.toLowerCase().includes('setor') || 
      f.label.toLowerCase().includes('bairro')
    );
    const regionFieldId = regionField?.id || 'f4';
    const defaultRegionOptions = regionField?.options || ['Regional Norte', 'Regional Sul', 'Regional Leste', 'Regional Oeste'];

    const regionsSet = new Set<string>();
    defaultRegionOptions.forEach(rOpt => regionsSet.add(rOpt));
    registrations.forEach(r => {
      const rVal = r[regionFieldId] || r.region;
      if (rVal) regionsSet.add(rVal);
    });

    const counts: Record<string, number> = {};
    regionsSet.forEach(reg => {
      counts[reg] = 0;
    });

    filteredRegistrations.forEach(r => {
      const regValue = r[regionFieldId] || r.region;
      if (regValue) {
        counts[regValue] = (counts[regValue] || 0) + 1;
      } else {
        const regions = Array.from(regionsSet);
        const charCodeSum = r.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const assigned = regions[charCodeSum % regions.length];
        if (assigned) {
          counts[assigned] = (counts[assigned] || 0) + 1;
        }
      }
    });

    const list = Object.entries(counts)
      .map(([region, count]) => ({ region, count }))
      .filter(item => item.count > 0);

    if (list.length === 0) {
      return Object.entries(counts).map(([region]) => ({ region, count: 0 }));
    }
    return list.sort((a, b) => b.count - a.count);
  }, [filteredRegistrations, registrations, formFields]);

  // Render application notifications banner
  const renderNotificationBanner = () => {
    if (!showNotification) return null;
    const statusClasses = {
      success: 'bg-[#dcfce7] text-[#166534] border-[#166534]/20',
      info: 'bg-[#e2dfff] text-[#3323cc] border-[#3323cc]/20',
      error: 'bg-[#fee2e2] text-[#991b1b] border-[#991b1b]/20',
    };
    return (
      <div className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-xl border-l-4 font-sans font-medium text-sm flex items-center gap-3 lifted-shadow animate-bounce ${statusClasses[showNotification.type]}`}>
        <span>{showNotification.message}</span>
        <button onClick={() => setShowNotification(null)} className="opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Renders Sidebar Navigation Row
  const renderSidebarItem = (view: ActiveView, label: string, icon: React.ReactNode) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => {
          setActiveView(view);
          setCurrentPage(1);
          setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg font-sans text-sm sidebar-item-transition ${
          isActive
            ? 'bg-[#4f46e5]/15 text-white border-l-4 border-[#3525cd] font-semibold'
            : 'text-[#c4c1fb] hover:text-white hover:bg-white/5'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  if (!isLoggedIn) {
    // Elegant Simplified Login View matching the requested layout design
    return (
      <div className="flex min-h-screen w-full bg-[#f7f9fb] font-sans">
        {/* Left Side: Solid Indigo branding banner with centred content */}
        <div className="hidden lg:flex lg:w-1/2 bg-[#4d44e3] flex-col justify-center items-center p-12 text-white relative">
          <div className="flex flex-col items-center">
            {/* Elegant group icon box with premium feel */}
            <div className="w-28 h-28 bg-[#5e55e9] border border-[#6f67ed] rounded-[2rem] flex items-center justify-center shadow-lg mb-6">
              <Users className="w-14 h-14 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1.5 text-center">
              Cadastros
            </h1>
            <p className="text-base text-white/80 text-center font-normal">
              Ana Carolina Oliveira
            </p>
            <div className="h-[1.5px] w-20 bg-white/20 mt-6" />
          </div>
        </div>

        {/* Right Side: Simple & beautiful form card on light background */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 md:px-16 bg-[#f7f9fb]">
          <div className="max-w-[440px] w-full bg-white p-8 sm:p-10 rounded-2xl border border-[#e4e7eb] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#191c1e] tracking-tight mb-1">Bem-vindo!</h2>
              <p className="text-sm text-gray-500">Acesse sua conta para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* E-mail Form Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-mail</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-white text-sm py-3 pl-11 pr-4 rounded-lg outline-none border border-gray-200 focus:border-[#4d44e3] focus:ring-1 focus:ring-[#4d44e3] text-[#191c1e] transition-all placeholder:text-gray-400"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Password Form Field */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Senha</label>
                  <button type="button" className="text-xs text-[#4d44e3] hover:underline font-medium">
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-white text-sm py-3 pl-11 pr-11 rounded-lg outline-none border border-gray-200 focus:border-[#4d44e3] focus:ring-1 focus:ring-[#4d44e3] text-[#191c1e] transition-all placeholder:text-gray-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Login Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 bg-[#4d44e3] hover:bg-[#3d34d3] text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-md shadow-[#4d44e3]/10"
              >
                <span>Entrar</span>
                <LogIn className="w-4 h-4" />
              </button>
            </form>

            {/* Support / Administrator Sign Up Contact Link */}
            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Não tem uma conta?{' '}
                <span className="text-[#4d44e3] font-semibold cursor-pointer hover:underline">
                  Fale com o administrador.
                </span>
              </p>
            </div>
          </div>
        </div>
        {renderNotificationBanner()}
      </div>
    );
  }

  // Active Main Panel Architecture (Logged in state)
  return (
    <div className="flex h-screen w-full bg-[#f7f9fb] text-[#191c1e] font-sans overflow-hidden">
      
      {/* 1. Persist SideNavBar in Deep Navy (Desktop only) */}
      <aside className="hidden lg:flex w-64 bg-[#181445] flex-col shrink-0 z-30 justify-between">
        <div>
          {/* Logo brand area */}
          <div className="p-6 border-b border-[#444173] flex items-center gap-3">
            <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center border border-[#c3c0ff]/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight block leading-none">AdminCore</span>
              <span className="text-[#c4c1fb] text-[10px] uppercase font-mono tracking-wider">Painel Executivo</span>
            </div>
          </div>
          
          {/* Navigation link stacks */}
          <nav className="p-4 space-y-1">
            {renderSidebarItem('dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
            {renderSidebarItem('cadastros', 'Cadastros Realizados', <Users className="w-4 h-4" />)}
            {renderSidebarItem('lideranças', 'Gestão de Lideranças', <Layers className="w-4 h-4" />)}
            {renderSidebarItem('formulário', 'Formulário Dinâmico', <Settings className="w-4 h-4" />)}
            {renderSidebarItem('relatórios', 'Relatórios & Demografia', <BarChart3 className="w-4 h-4" />)}
            {renderSidebarItem('perfil', 'Meu Perfil', <User className="w-4 h-4" />)}
          </nav>
        </div>

        {/* CTA Stack and logout button in the bottom of SideNav */}
        <div className="p-4 border-t border-[#444173] space-y-3">
          <button 
            onClick={() => {
              // Open add registration drawer utilizing standard constructed dynamic fields
              setShowAddRegistrationModal(true);
            }}
            className="w-full bg-[#3525cd] hover:bg-[#4f46e5] text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cadastro</span>
          </button>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#c4c1fb] hover:text-white hover:bg-white/5 font-sans text-sm sidebar-item-transition text-left transition-all"
            title="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Drawer Overlay & Sidebar for Celular / Tablet */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Smooth backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-45 lg:hidden"
            />
            {/* Slide-in sidebar drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 w-64 bg-[#181445] flex flex-col z-50 justify-between shadow-2xl lg:hidden"
            >
              <div>
                {/* Logo brand area & close handler */}
                <div className="p-6 border-b border-[#444173] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center border border-[#c3c0ff]/20">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-lg tracking-tight block leading-none">AdminCore</span>
                      <span className="text-[#c4c1fb] text-[10px] uppercase font-mono tracking-wider">Painel Executivo</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-[#c4c1fb] hover:text-white hover:bg-white/10 transition-colors"
                    title="Fechar menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Drawer Menu Stacks */}
                <nav className="p-4 space-y-1">
                  {renderSidebarItem('dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
                  {renderSidebarItem('cadastros', 'Cadastros Realizados', <Users className="w-4 h-4" />)}
                  {renderSidebarItem('lideranças', 'Gestão de Lideranças', <Layers className="w-4 h-4" />)}
                  {renderSidebarItem('formulário', 'Formulário Dinâmico', <Settings className="w-4 h-4" />)}
                  {renderSidebarItem('relatórios', 'Relatórios & Demografia', <BarChart3 className="w-4 h-4" />)}
                  {renderSidebarItem('perfil', 'Meu Perfil', <User className="w-4 h-4" />)}
                </nav>
              </div>

              {/* Botão de Novo Cadastro e Sair no rodapé do Drawer */}
              <div className="p-4 border-t border-[#444173] space-y-3 font-sans">
                <button 
                  onClick={() => {
                    setShowAddRegistrationModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#3525cd] hover:bg-[#4f46e5] text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Cadastro</span>
                </button>

                <button 
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#c4c1fb] hover:text-white hover:bg-white/5 font-sans text-sm sidebar-item-transition text-left transition-all"
                  title="Sair do sistema"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 2. Main Content canvas area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header Row with profile details */}
        <header className="h-16 bg-white border-b border-[#eceef0] flex items-center justify-between px-4 sm:px-8 shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-3 shrink-0">
            {/* Hamburger Button for Celular and Tablet */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-[#f2f4f6] transition-colors focus:outline-none"
              title="Abrir menu"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-[#191c1e] tracking-tight flex items-center gap-2 uppercase">
              {activeView === 'dashboard' && 'Visão Geral'}
              {activeView === 'cadastros' && 'Cadastros no Sistema'}
              {activeView === 'lideranças' && 'Lideranças de Campo'}
              {activeView === 'formulário' && 'Editor do Formulário'}
              {activeView === 'relatórios' && 'Central de Relatórios'}
              {activeView === 'perfil' && 'Perfil de Usuário'}
            </h1>
          </div>

          {/* Supabase Status Pill */}
          <div className="hidden md:flex items-center gap-2">
            {!isSupabaseConfigured ? (
              <div 
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold cursor-help shadow-sm"
                title="Sincronização em localStorage ativa. Adicione as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu .env para conectar ao Supabase."
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <Database className="w-3.5 h-3.5 text-amber-500" />
                <span>Modo Local Fallback</span>
              </div>
            ) : isSupabaseConnected ? (
              <div 
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold shadow-sm"
                title="Integrado e sincronizando em tempo real com o banco de dados Supabase."
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <Database className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span>Supabase Conectado</span>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold shadow-sm"
                title="As credenciais do Supabase foram encontradas, mas a conexão falhou. Verifique seu banco ou as chaves no arquivo de configuração do ambiente."
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <Database className="w-3.5 h-3.5 text-rose-500" />
                <span>Erro no Supabase</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setActiveView('perfil');
              setCurrentPage(1);
            }}
            className="flex items-center gap-3 hover:bg-[#f2f4f6] p-1.5 pr-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-[#eceef0] text-left outline-none"
            title="Acessar Meu Perfil"
          >
            <img 
              src={profile.avatarUrl} 
              alt="Profile Avatar" 
              className="w-9 h-9 rounded-full border border-[#eceef0] object-cover shadow-sm bg-gray-50"
            />
            <div className="hidden sm:block">
              <p className="text-[#191c1e] font-semibold text-xs leading-tight">{profile.name}</p>
              <p className="text-[#777587] text-[10px] uppercase font-mono tracking-wider leading-none mt-0.5">Administrador</p>
            </div>
          </button>
        </header>

        {/* 3. Render content blocks based on selected SideNavBar menu index view link */}
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-[#f7f9fb] space-y-8">
          
          {/* BANNER NOTIFICATION INSIDE THE CANCELABLE CONTEXT */}
          {activeView === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              {/* Bento Welcome Banner header and counter */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                
                <div className="col-span-2 lg:col-span-3 bg-gradient-to-br from-[#3525cd] via-[#4f46e5] to-[#181445] p-6 rounded-2xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden">
                  <div className="relative z-10 max-w-xl">
                    <h2 className="text-3xl font-bold tracking-tight mb-2">Olá, {profile.name}!</h2>
                    <p className="text-[#c4c1fb] text-sm font-light leading-relaxed mb-4">
                      Seu desempenho este mês superou a média em <strong className="text-white font-semibold">12%</strong>. Todas as ferramentas dinâmicas de fidelização e auditoria estão atualizadas e prontas para uso.
                    </p>
                  </div>
                  <div className="relative z-10 flex gap-3 mt-4">
                    <button 
                      onClick={() => setActiveView('relatórios')}
                      className="bg-white text-[#3525cd] hover:bg-[#f2f4f6] px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow transition-colors"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Ver Relatórios Avançados</span>
                    </button>
                    <button 
                      onClick={() => setActiveView('cadastros')}
                      className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 transition-colors"
                    >
                      <span>Visualizar Todos os Cadastros</span>
                    </button>
                  </div>
                  {/* Background decoration bubble grid overlay */}
                  <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                </div>

                <div 
                  onClick={() => {
                    setActiveView('cadastros');
                    setCurrentPage(1);
                  }}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between items-center text-center group hover:border-[#3525cd] hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#e2dfff] rounded-full flex items-center justify-center text-[#3525cd] group-hover:scale-110 transition-transform mb-2 sm:mb-3">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-[#464555] uppercase tracking-wider mb-1 line-clamp-1">Total de Cadastros</span>
                  <span className="text-2xl sm:text-3xl font-bold text-[#191c1e] tracking-tight">{totalCadastrosValue}</span>
                  <span className="text-[10px] sm:text-xs text-[#3525cd] font-bold bg-[#e2dfff] px-2 sm:px-2.5 py-0.5 rounded-full mt-3">
                    +{totalLeadsThisMonth} este mês
                  </span>
                </div>

                <div 
                  onClick={() => {
                    setActiveView('lideranças');
                    setCurrentPage(1);
                  }}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between items-center text-center group hover:border-[#3525cd] hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#efeafd] rounded-full flex items-center justify-center text-[#6366f1] group-hover:scale-110 transition-transform mb-2 sm:mb-3">
                    <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-[#464555] uppercase tracking-wider mb-1 line-clamp-1">Lideranças Cadastradas</span>
                  <span className="text-2xl sm:text-3xl font-bold text-[#191c1e] tracking-tight">{leaders.length}</span>
                  <span className="text-[10px] sm:text-xs text-[#6366f1] font-bold bg-[#efeafd] px-2 sm:px-2.5 py-0.5 rounded-full mt-3">
                    Gerenciar Lideranças
                  </span>
                </div>
              </div>

              {/* divulgation and performance columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Divulgation tools cards */}
                <div className="space-y-6">
                  <h3 className="text-base font-bold text-[#191c1e] uppercase tracking-wider">Divulgação de Campo</h3>
                  
                  <div className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#e2dfff] flex items-center justify-center text-[#181445]">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-[#191c1e] uppercase tracking-wider">Link Exclusivo de Coleta</span>
                    </div>
                    <div className="flex items-center gap-2 bg-[#f2f4f6] p-3 rounded-lg border border-[#eceef0] text-xs">
                      <span className="truncate flex-1 font-mono text-[#464555]">{currentLeaderLink}</span>
                      <button 
                        onClick={() => handleCopyLink(currentLeaderLink)}
                        className="text-[#3525cd] hover:text-[#4f46e5] shrink-0 p-1 rounded hover:bg-white/30"
                        title="Copiar link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-[#777587]">
                      Compartilhe este link para atribuir automaticamente e em tempo real todos os novos registros à sua rede de liderança de campo.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-[#eceef0] shadow-sm flex items-center justify-between group hover:border-[#3525cd] transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <QrCode className="w-4 h-4 text-[#3525cd]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#191c1e]">QR Code Pessoal</span>
                      </div>
                      <button 
                        onClick={() => handleDownloadPersonalQR(currentLeaderLink, `qr-code-${profile.name.toLowerCase().replace(/\s+/g, '-')}.png`)}
                        className="text-xs text-[#3525cd] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Download className="w-3 h-3" />
                        <span>Baixar PNG</span>
                      </button>
                    </div>
                    <div className="w-16 h-16 bg-[#f2f4f6] p-1 border border-[#eceef0] rounded-xl flex items-center justify-center overflow-hidden">
                      <QRCodeImage text={currentLeaderLink} size={64} className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>

                {/* Dynamic graphic line performance chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-[#191c1e] uppercase tracking-wider">Meu Desempenho</h3>
                      <p className="text-xs text-[#777587]">
                        {performanceChartData.subtitle}
                      </p>
                    </div>
                    <select 
                      value={performancePeriod}
                      onChange={(e) => {
                        setPerformancePeriod(e.target.value as 'Diário' | 'Semanal' | 'Mensal');
                        setHoveredPointIndex(null);
                      }}
                      className="bg-[#f2f4f6] border-none rounded-lg text-xs py-1.5 px-3 outline-none text-[#191c1e] font-semibold cursor-pointer hover:bg-[#eceef0] transition-colors"
                    >
                      <option value="Diário">Diário (Últimos 15 Dias)</option>
                      <option value="Semanal">Semanal (Últimas 8 Semanas)</option>
                      <option value="Mensal">Mensal (Últimos 12 Meses)</option>
                    </select>
                  </div>

                  {/* Responsive interactive SVG Line Chart */}
                  <div className="relative w-full h-44 pt-3 select-none">
                    {(() => {
                      const wVal = 500;
                      const hVal = 180;
                      const padLeft = 0;
                      const padRight = 0;
                      const padTop = 15;
                      const padBottom = 25;
                      
                      const activeW = wVal - padLeft - padRight;
                      const activeH = hVal - padTop - padBottom;
                      
                      const maxVal = Math.max(...performanceChartData.points.map(p => p.count), 1);
                      
                      const pointsPositions = performanceChartData.points.map((p, index) => {
                        const x = padLeft + (index * (activeW / (performanceChartData.points.length - 1)));
                        const y = (hVal - padBottom) - ((p.count / maxVal) * activeH);
                        return { x, y, label: p.label, count: p.count };
                      });
                      
                      // Construct stroke line path
                      const pathD = pointsPositions.reduce((acc, curr, index) => {
                        return index === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                      }, '');
                      
                      // Construct gradient area path
                      const areaD = pointsPositions.length > 0 
                        ? `${pathD} L ${pointsPositions[pointsPositions.length - 1].x} ${hVal - padBottom} L ${pointsPositions[0].x} ${hVal - padBottom} Z`
                        : '';

                      return (
                        <>
                          <svg viewBox={`0 0 ${wVal} ${hVal}`} className="w-full h-full overflow-visible">
                            <defs>
                              {/* Glowing blue line gradient */}
                              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3525cd" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#3525cd" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Horizontal grid guide lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                              const yLine = padTop + (activeH * ratio);
                              return (
                                <line 
                                  key={i} 
                                  x1={padLeft} 
                                  y1={yLine} 
                                  x2={wVal - padRight} 
                                  y2={yLine} 
                                  stroke="#f2f4f6" 
                                  strokeWidth="1" 
                                  strokeDasharray="3 3"
                                />
                              );
                            })}

                            {/* Area layout fill */}
                            {areaD && (
                              <path 
                                d={areaD} 
                                fill="url(#chartGradient)" 
                                className="transition-all duration-500 ease-in-out"
                              />
                            )}

                            {/* Line stroke */}
                            {pathD && (
                              <path 
                                d={pathD} 
                                fill="none" 
                                stroke="#3525cd" 
                                strokeWidth="3" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="transition-all duration-500 ease-in-out"
                              />
                            )}

                            {/* Horizontal X Axis labels */}
                            {pointsPositions.map((p, i) => (
                              <text 
                                key={i} 
                                x={p.x} 
                                y={hVal - 5} 
                                textAnchor={i === 0 ? "start" : i === pointsPositions.length - 1 ? "end" : "middle"} 
                                className={`text-[10px] font-bold font-sans ${hoveredPointIndex === i ? 'fill-[#3525cd]' : 'fill-[#777587]'}`}
                              >
                                {p.label}
                              </text>
                            ))}

                            {/* Invisible interaction bars for easy cursor landing */}
                            {pointsPositions.map((p, i) => {
                              const colWidth = activeW / (performanceChartData.points.length - 1);
                              return (
                                <rect 
                                  key={i}
                                  x={p.x - colWidth / 2}
                                  y={padTop}
                                  width={colWidth}
                                  height={activeH + 10}
                                  fill="transparent"
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPointIndex(i)}
                                  onMouseLeave={() => setHoveredPointIndex(null)}
                                />
                              );
                            })}

                            {/* Interactive indicators/circles */}
                            {pointsPositions.map((p, i) => (
                              <circle 
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={hoveredPointIndex === i ? 6 : 4}
                                fill={hoveredPointIndex === i ? '#3525cd' : '#ffffff'}
                                stroke="#3525cd"
                                strokeWidth={hoveredPointIndex === i ? 2 : 2.5}
                                className="transition-all duration-150 pointer-events-none"
                              />
                            ))}
                          </svg>

                          {/* Hover tooltip widget overlay */}
                          {hoveredPointIndex !== null && pointsPositions[hoveredPointIndex] && (
                            <div 
                              className="absolute z-20 pointer-events-none bg-[#181445] text-white text-[11px] font-sans rounded-lg px-2.5 py-1.5 shadow-xl border border-white/10 flex flex-col min-w-[100px] transition-all duration-155 animate-fade-in"
                              style={{
                                left: `${(pointsPositions[hoveredPointIndex].x / wVal) * 100}%`,
                                top: `${(pointsPositions[hoveredPointIndex].y / hVal) * 100 - 32}%`,
                                transform: 'translateX(-50%)',
                              }}
                            >
                              <span className="font-bold text-[9px] text-[#a5b4fc] tracking-widest uppercase">{pointsPositions[hoveredPointIndex].label}</span>
                              <span className="font-extrabold text-[#ffffff] mt-0.5">{pointsPositions[hoveredPointIndex].count} cadastros</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex justify-between items-center text-xs mt-4">
                    <span className="text-[#464555]">
                      Média registrada: <strong className="text-[#191c1e]">{performanceChartData.avg}</strong>
                    </span>
                    <span className={`px-3 py-1 rounded-full font-bold text-[#166534] bg-[#dcfce7]`}>
                      {performanceChartData.growth}
                    </span>
                  </div>
                </div>
              </div>

              {/* Table rendering the highly reactive recent data */}
              <div className="bg-white rounded-2xl border border-[#eceef0] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#eceef0] flex justify-between items-center">
                  <h3 className="text-sm font-bold text-[#191c1e] uppercase tracking-wider">Seus Cadastros Recentes no Painel</h3>
                  <button 
                    onClick={() => setActiveView('cadastros')} 
                    className="text-[#3525cd] text-xs font-semibold hover:underline"
                  >
                    Ver todos cadastros
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: '1000px', tableLayout: 'auto' }}>
                    <thead className="bg-[#f2f4f6] text-[#464555] text-[11px] uppercase tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Nome</th>
                        <th className="px-6 py-3.5 font-semibold">Liderança Associada</th>
                        <th className="px-6 py-3.5 font-semibold">Categoria</th>
                        <th className="px-6 py-3.5 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eceef0] text-sm text-[#191c1e]">
                      {registrations.slice(0, 4).map((reg) => {
                        return (
                          <tr key={reg.id} className="hover:bg-[#f7f9fb] transition-colors whitespace-nowrap">
                            <td className="px-6 py-4 font-semibold">{reg.name}</td>
                            <td className="px-6 py-4 text-[#777587] font-medium">{reg.leaderName}</td>
                            <td className="px-6 py-4">
                              <span className="bg-[#e2dfff] text-[#3323cc] font-mono text-[11px] px-2.5 py-1 rounded-md uppercase tracking-wider">
                                {reg.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex gap-1 justify-end">
                                <button
                                  onClick={() => handleViewRegistration(reg)}
                                  className="p-1.5 hover:bg-white text-[#3323cc] hover:text-[#3525cd] rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Visualizar Cadastro"
                                >
                                  <Eye className="w-4.5 h-4.5" />
                                </button>
                                <button
                                  onClick={() => handleEditRegistrationClick(reg)}
                                  className="p-1.5 hover:bg-white text-[#4f46e5] rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Editar Cadastro"
                                >
                                  <Edit className="w-4.5 h-4.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(reg.id, reg.name)}
                                  className="p-1.5 hover:bg-white text-red-600 rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Remover Registro"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REGISTERED LIST VIEW */}
          {activeView === 'cadastros' && (
            <div className="space-y-6 animate-fade-in bg-white p-6 rounded-2xl border border-[#eceef0] shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#eceef0] pb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#191c1e] tracking-tight mb-1">Membros Cadastrados</h2>
                  <p className="text-xs text-[#777587]">Auditoria geral de registros associados a todas as lideranças corporativas.</p>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => handleExport('Excel')}
                    className="border border-[#c7c4d8] text-[#191c1e] hover:bg-[#f2f4f6] px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Exportar Excel</span>
                  </button>
                  <button 
                    onClick={() => setShowAddRegistrationModal(true)}
                    className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Novo</span>
                  </button>
                </div>
              </div>

              {/* Filtering indicators inside registries */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#f2f4f6]/50 p-4 rounded-xl border border-[#eceef0]">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#777587] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome do cadastrado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white border border-[#c7c4d8] rounded-lg py-2 pl-9 pr-4 text-xs outline-none focus:border-[#4f46e5] text-[#191c1e] w-full transition-all"
                  />
                </div>

                <select 
                  value={filterLeader} 
                  onChange={(e) => setFilterLeader(e.target.value)}
                  className="bg-white border border-[#c7c4d8] rounded-lg py-2 px-3 text-xs outline-none focus:border-[#4f46e5] text-[#191c1e] font-semibold"
                >
                  <option>Todas as Lideranças</option>
                  {leaders.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>

                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-white border border-[#c7c4d8] rounded-lg py-2 px-3 text-xs outline-none focus:border-[#4f46e5] text-[#191c1e] font-semibold"
                >
                  <option>Todas as Categorias</option>
                  {CATEGORIES_LIST.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Large functional registrations table */}
              <div className="overflow-x-auto rounded-xl border border-[#eceef0] shadow-sm">
                <table className="w-full text-left" style={{ minWidth: '1100px', tableLayout: 'auto' }}>
                  <thead className="bg-[#f2f4f6] text-[#464555] text-[11px] uppercase tracking-wider whitespace-nowrap">
                    <tr>
                      <th className="px-6 py-3">Nome Completo</th>
                      <th className="px-6 py-3">Selo de Liderança</th>
                      <th className="px-6 py-3">Categoria Cadastrada</th>
                      <th className="px-6 py-3">Período de Entrada</th>
                      <th className="px-6 py-3 text-right">Controles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceef0] text-sm text-[#191c1e]">
                    {filteredRegistrations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#777587]">
                          Nenhum cadastro correspondente aos filtros foi encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredRegistrations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((reg) => {
                        return (
                          <tr key={reg.id} className="hover:bg-[#f7f9fb] transition-colors whitespace-nowrap">
                            <td className="px-6 py-4 font-bold text-[#191c1e]">{reg.name}</td>
                            <td className="px-6 py-4 text-[#777587] font-medium">{reg.leaderName}</td>
                            <td className="px-6 py-4">
                              <span className="bg-[#e2dfff] text-[#3323cc] text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                {reg.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-[#777587]">{reg.date}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex gap-1 justify-end">
                                <button
                                  onClick={() => handleViewRegistration(reg)}
                                  className="p-1.5 hover:bg-white text-[#3323cc] hover:text-[#3525cd] rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Visualizar Cadastro"
                                >
                                  <Eye className="w-4.5 h-4.5" />
                                </button>
                                <button
                                  onClick={() => handleEditRegistrationClick(reg)}
                                  className="p-1.5 hover:bg-white text-[#4f46e5] rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Editar Cadastro"
                                >
                                  <Edit className="w-4.5 h-4.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(reg.id, reg.name)}
                                  className="p-1.5 hover:bg-white text-red-600 rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Excluir Registro"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* pagination controls */}
              {filteredRegistrations.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-[#777587] pt-4 gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredRegistrations.length)} de {filteredRegistrations.length} resultados
                    </span>
                    <span className="text-[#c7c4d8]">|</span>
                    <div className="flex items-center gap-1.5">
                      <span>Exibir:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-[#f2f4f6] border border-[#eceef0] rounded-lg px-2.5 py-1.5 outline-none text-xs font-semibold text-[#191c1e] cursor-pointer focus:bg-white transition-colors"
                      >
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
                        <option value={200}>200 por página</option>
                      </select>
                    </div>
                  </div>
                  {filteredRegistrations.length > itemsPerPage && (
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className="px-3 py-1.5 rounded border border-[#eceef0] bg-[#f2f4f6] hover:bg-[#eceef0] disabled:opacity-50 font-semibold cursor-pointer disabled:cursor-not-allowed transition-all"
                      >
                        Anterior
                      </button>
                      <button 
                        disabled={currentPage * itemsPerPage >= filteredRegistrations.length}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="px-3 py-1.5 rounded border border-[#eceef0] bg-[#f2f4f6] hover:bg-[#eceef0] disabled:opacity-50 font-semibold cursor-pointer disabled:cursor-not-allowed transition-all"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* LEADERS VIEW SCREEN */}
          {activeView === 'lideranças' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-bold text-[#191c1e] tracking-tight">Gestão de Lideranças</h2>
                  <p className="text-xs text-[#777587]">Gerencie credenciais e monitore em tempo real o desempenho de conversões de campo.</p>
                </div>
                
                <button 
                  onClick={() => {
                    setEditingLeader(null);
                    setNewLeaderName('');
                    setNewLeaderEmail('');
                    setNewLeaderPhone('');
                    setNewLeaderCPF('');
                    setShowAddLeaderModal(true);
                  }}
                  className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Liderança</span>
                </button>
              </div>

              {/* High precision leaders statistic headers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="bg-white p-5 rounded-xl border border-[#eceef0] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#777587] uppercase tracking-wider mb-1">Total de Lideranças</p>
                    <h4 className="text-2xl font-bold text-[#191c1e]">{leaders.length}</h4>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#e2dfff] text-[#3323cc] flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#eceef0] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#777587] uppercase tracking-wider mb-1">Lideranças Inativas</p>
                    <h4 className="text-2xl font-bold text-[#ba1a1a]">{inactiveLeadersCount}</h4>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#eceef0] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#777587] uppercase tracking-wider mb-1">Cadastros Realizados</p>
                    <h4 className="text-2xl font-bold text-[#3525cd]">
                      {leaders.reduce((sum, current) => sum + current.registrationCount, 0)}
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#e2dfff] text-[#3525cd] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-[#eceef0] shadow-sm overflow-hidden text-left">
                <div className="p-6 border-b border-[#eceef0] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f2f4f6]/30">
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#777587] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Buscar lideranças..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-[#c7c4d8] rounded-lg py-2 pl-10 pr-4 text-xs outline-none focus:border-[#4f46e5]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: '1000px', tableLayout: 'auto' }}>
                    <thead className="bg-[#f2f4f6] text-[#464555] text-[11px] uppercase tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="px-6 py-4 border-b border-[#eceef0]">Liderança</th>
                        <th className="px-6 py-4 border-b border-[#eceef0]">E-mail Corporativo</th>
                        <th className="px-6 py-4 border-b border-[#eceef0]">Status</th>
                        <th className="px-6 py-4 border-b border-[#eceef0] text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eceef0] text-sm text-[#191c1e]">
                      {leaders.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).map((leader) => {
                        const scoreMax = 3000;
                        const scorePercent = Math.min((leader.registrationCount / scoreMax) * 100, 100);

                        return (
                          <tr key={leader.id} className="hover:bg-[#f7f9fb] transition-colors whitespace-nowrap">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={leader.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#c7c4d8]" />
                                <span className="font-bold text-[#191c1e]">{leader.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="text-[#464555] font-mono font-medium">{leader.email}</span>
                                {leader.cpf && (
                                  <span className="text-[#777587] font-mono text-[10px]">CPF: {leader.cpf}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => toggleLeaderStatus(leader.id)}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase cursor-pointer hover:opacity-85 ${
                                  leader.status === 'Ativo' 
                                    ? 'bg-[#dcfce7] text-[#166534]' 
                                    : 'bg-[#fee2e2] text-[#991b1b]'
                                }`}
                              >
                                {leader.status}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => setViewingLeaderQR(leader)}
                                  className="p-1.5 hover:bg-white text-[#3323cc] hover:text-[#3525cd] rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Ver QR Code do Líder"
                                >
                                  <QrCode className="w-4.5 h-4.5" />
                                </button>
                                <button 
                                  onClick={() => handleEditLeaderClick(leader)}
                                  className="p-1.5 hover:bg-white text-[#4f46e5] rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Editar Liderança"
                                >
                                  <Edit className="w-4.5 h-4.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteLeader(leader.id, leader.name)}
                                  className="p-1.5 hover:bg-white text-red-600 rounded-lg border border-transparent hover:border-[#eceef0]"
                                  title="Excluir Liderança"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC FORM CONFIGURATOR BUILDER SCREEN */}
          {activeView === 'formulário' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="flex justify-between items-end border-b border-[#eceef0] pb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#191c1e] tracking-tight">Formulário de Coleta Dinâmico</h2>
                  <p className="text-xs text-[#777587]">Personalize em tempo real a estrutura de dados e campos que as lideranças utilizam para coletar novos membros.</p>
                </div>
                
                <button 
                  onClick={() => triggerNotification('Estrutura de formulário dinâmica salva no banco de dados corporativo!', 'success')}
                  className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-transform active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>

              <div className="grid grid-cols-12 gap-8">
                
                {/* Left library column */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                  <div className="bg-white rounded-2xl border border-[#eceef0] p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-[#191c1e] uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#3525cd]" />
                      <span>Biblioteca de Campos</span>
                    </h3>
                    
                    <div className="flex flex-col gap-2">
                      {[
                        { type: 'text', label: 'Texto Curto', desc: 'Ideal para nomes' },
                        { type: 'email', label: 'E-mail de Contato', desc: 'Coleta de correio' },
                        { type: 'tel', label: 'Telefone Celular', desc: 'Máscara numérica' },
                        { type: 'cpf', label: 'Validação de CPF', desc: 'Verificador fiscal' },
                        { type: 'select', label: 'Seleção Dropdown', desc: 'Menu de escolha único' },
                        { type: 'h2', label: 'Título Secundário', desc: 'Exibe H2 decorativo' },
                        { type: 'p', label: 'Parágrafo Informativo', desc: 'Exposição textual' },
                      ].map((item, id) => (
                        <button 
                          key={id}
                          onClick={() => addFieldToForm(item.type as FormField['type'])}
                          className="w-full text-left p-3 rounded-lg border border-[#eceef0] hover:border-[#3525cd] hover:bg-[#e2dfff]/20 transition-all flex items-center justify-between group"
                        >
                          <div>
                            <span className="text-xs font-bold text-[#191c1e] block uppercase group-hover:text-[#3525cd]">{item.label}</span>
                            <span className="text-[10px] text-[#777587]">{item.desc}</span>
                          </div>
                          <Plus className="w-4 h-4 text-[#777587] group-hover:text-[#3525cd]" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* center configuration manager list */}
                <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-white rounded-2xl border border-[#eceef0] shadow-sm flex flex-col min-h-[500px]">
                    <div className="p-4 border-b border-[#eceef0] bg-[#f2f4f6] rounded-t-2xl flex justify-between items-center">
                      <h4 className="text-xs font-bold text-[#191c1e] uppercase tracking-wider">Estrutura de Campos Ativos</h4>
                      <span className="px-2.5 py-0.5 bg-[#e2dfff] text-[#3525cd] text-[10px] font-bold rounded">
                        {formFields.length} Campos Ativos
                      </span>
                    </div>

                    <div className="flex-1 p-4 space-y-3">
                      {formFields.map((field, index) => (
                        <div key={field.id} className="p-4 bg-white border border-[#eceef0] rounded-xl flex items-center justify-between shadow-sm group hover:border-[#3525cd] transition-all">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono bg-[#e2dfff] text-[#3323cc] font-bold px-2 py-0.5 rounded uppercase">
                                {field.type}
                              </span>
                              {field.required && (
                                <span className="text-[9px] bg-[#dcfce7] text-[#166534] font-bold px-2 py-0.5 rounded uppercase">
                                  Obrigatório
                                </span>
                              )}
                            </div>
                            
                            {/* Inputs matching actual editing content dynamically */}
                            <input 
                              type="text"
                              value={field.label}
                              onChange={(e) => {
                                setFormFields(formFields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f));
                              }}
                              className="font-bold text-sm text-[#191c1e] bg-transparent border-b border-transparent hover:border-[#eceef0] focus:border-[#3525cd] focus:bg-[#f2f4f6] outline-none px-1 py-0.5 rounded transition-all w-full"
                            />
                            
                            {field.type !== 'h2' && field.type !== 'p' && (
                              <input 
                                type="text"
                                placeholder="Mensagem placeholder..."
                                value={field.placeholder || ''}
                                onChange={(e) => {
                                  setFormFields(formFields.map(f => f.id === field.id ? { ...f, placeholder: e.target.value } : f));
                                }}
                                className="text-xs text-[#777587] bg-transparent border-b border-transparent hover:border-[#eceef0] focus:border-[#3525cd] outline-none px-1 py-0.5 rounded w-full block"
                              />
                            )}

                            {field.type === 'select' && (
                              <input 
                                type="text"
                                placeholder="Opções separadas por vírgula..."
                                value={field.options?.join(', ') || ''}
                                onChange={(e) => {
                                  setFormFields(formFields.map(f => f.id === field.id ? { ...f, options: e.target.value.split(',').map(s => s.trim()) } : f));
                                }}
                                className="text-xs text-[#3525cd] font-mono bg-[#f2f4f6] border border-transparent rounded px-2 py-1 outline-none w-full block mt-2"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-4">
                            <button 
                              onClick={() => moveField(index, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-[#f2f4f6] rounded disabled:opacity-30 text-[#464555]"
                              title="Subir"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => moveField(index, 'down')}
                              disabled={index === formFields.length - 1}
                              className="p-1 hover:bg-[#f2f4f6] rounded disabled:opacity-30 text-[#464555]"
                              title="Descer"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            {field.type !== 'h2' && field.type !== 'p' && (
                              <button 
                                onClick={() => toggleFieldRequired(field.id)}
                                className={`p-1.5 rounded transition-colors ${field.required ? 'text-[#166534] bg-[#dcfce7]' : 'text-[#777587] hover:bg-[#f2f4f6]'}`}
                                title={field.required ? 'Tornar campo opcional' : 'Tornar obrigatório'}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => deleteField(field.id)}
                              className="p-1.5 hover:bg-red-50 text-[#ba1a1a] rounded transition-colors"
                              title="Remover campo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right real-time responsive simulation block */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                  <div className="bg-white rounded-2xl border-2 border-[#3525cd]/30 shadow-lg flex flex-col h-[650px] overflow-hidden relative">
                    <div className="bg-[#3525cd] p-4 text-white flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4.5 h-4.5" />
                        <span className="font-bold text-xs uppercase tracking-wider">Visualização em Tempo Real</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-[#f2f4f6] space-y-4">
                      <div className="bg-white p-5 rounded-xl border border-[#eceef0] shadow-sm text-left">
                        <h4 className="text-lg font-bold text-[#3525cd] mb-1 leading-tight">Ficha de Novo Membro</h4>
                        <p className="text-xs text-[#777587] mb-5">Exemplo da tela final exibida no aplicativo do líder em campo.</p>
                        
                        <div className="space-y-4 font-sans">
                          {formFields.map((field) => {
                            if (field.type === 'h2') {
                              return <h3 key={field.id} className="text-sm font-bold border-b pb-1 pt-2">{field.label}</h3>;
                            }
                            if (field.type === 'p') {
                              return <p key={field.id} className="text-xs text-[#777587] italic leading-tight">{field.label}</p>;
                            }
                            return (
                              <div key={field.id} className="text-xs space-y-1">
                                <label className="block font-bold text-[#191c1e]">
                                  {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                {field.type === 'select' ? (
                                  <select className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2 px-3 text-xs outline-none">
                                    <option>Selecione uma opção...</option>
                                    {field.options?.map((opt, i) => (
                                      <option key={i} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input 
                                    type={field.type === 'email' ? 'email' : 'text'}
                                    placeholder={field.placeholder || ''}
                                    className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2 px-3 text-xs outline-none"
                                    disabled
                                  />
                                )}
                              </div>
                            );
                          })}

                          <button 
                            onClick={() => triggerNotification('Formulário simulado com sucesso. Tudo funcionando de forma perfeita!', 'success')}
                            className="w-full bg-[#3525cd] text-white py-3 rounded-xl font-bold text-xs shadow mt-4 block"
                          >
                            Enviar Cadastro (Demo)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ANALYTICAL REPORTS VIEW SCREEN */}
          {activeView === 'relatórios' && (
            <div className="space-y-8 animate-fade-in text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#eceef0] pb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#191c1e] tracking-tight">Relatórios Consolidados</h2>
                  <p className="text-xs text-[#777587]">Contabilização volumétrica e representatividade demográfica dos cadastros efetuados.</p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleExport('Excel')}
                    className="border border-[#c7c4d8] text-[#191c1e] hover:bg-[#f2f4f6] px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Exportar Excel</span>
                  </button>
                  <button 
                    onClick={() => handleExport('PDF')}
                    className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 shadow transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </div>

              {/* 5 Cards indicator grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                
                <div 
                  onClick={() => {
                    setActiveView('cadastros');
                    setCurrentPage(1);
                  }}
                  className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#3525cd] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#464555] uppercase tracking-wider">Total de Cadastros</span>
                    <Users className="w-5 h-5 text-[#3525cd] group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight text-[#191c1e]">{filteredRegistrations.length}</h3>
                  <span className="text-[#166534] text-[11px] font-bold mt-2 inline-flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+12.5% em relação ao planejado</span>
                  </span>
                </div>

                <div 
                  onClick={() => {
                    setActiveView('lideranças');
                    setCurrentPage(1);
                  }}
                  className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#3525cd] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#464555] uppercase tracking-wider">Lideranças Cadastradas</span>
                    <Layers className="w-5 h-5 text-[#6366f1] group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight text-[#191c1e]">{leaders.length}</h3>
                  <span className="text-[#6366f1] text-[11px] font-bold mt-2 inline-flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Gerenciar Lideranças</span>
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#464555] uppercase tracking-wider">Novos este Mês</span>
                    <Calendar className="w-5 h-5 text-[#7e3000]" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight text-[#191c1e]">{filteredLeadsThisMonth}</h3>
                  <span className="text-xs text-[#777587] mt-2">Meta Mensal de Período: 400</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#464555] uppercase tracking-wider">Taxa de Conversão</span>
                    <BarChart3 className="w-5 h-5 text-[#5b598c]" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight text-[#191c1e]">{taxaConversao}%</h3>
                  <span className="text-[#166534] text-[11px] font-bold mt-2 inline-flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Envolvimento de Líderes Ativos</span>
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#464555] uppercase tracking-wider">Liderança Destaque do Mês</span>
                    <TrendingUp className="w-5 h-5 text-yellow-600" />
                  </div>
                  {outstandingLeaderData.leader ? (
                    <div className="flex items-center gap-3 mt-1">
                      <img 
                        src={outstandingLeaderData.leader.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBqSqcWc2kJo5-jPOAsbeGIb73aG0i_QnKy9b-NmRm3CWjLDJj4hYwyMD3D8hoylJyWJr2TNTScNu6gweCSmnYvCLbCAlhNTQ2BMZE5YnNxIzMvoAZ2P0JNm0DXeAEmRBgegNC_W7C-vKE26uOQpcfSt52h0K4UZnWBTXokjMEBuZyJq8qoHxpEzIjbC78LKdoM5eTOIK9y-kzr0kb3cKL5aD46C_lP1tU9KHX7Uv7ixekHZh-ZryJEIwsri-E3rBGiMVgf5oCpXZOc'} 
                        alt={outstandingLeaderData.leader.name} 
                        className="w-12 h-12 rounded-full border border-[#eceef0] object-cover shadow-sm bg-gray-50"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#191c1e] truncate">
                          {outstandingLeaderData.leader.name}
                        </h3>
                        <p className="text-xs text-[#777587] font-medium leading-tight mt-0.5">
                          {outstandingLeaderData.count} {outstandingLeaderData.count === 1 ? 'cadastro coletado' : 'cadastros coletados'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#777587] py-2">
                      Nenhum cadastro coletado no período filtrado.
                    </div>
                  )}
                </div>

              </div>

              {/* Advanced multi-select filtering tools with visual date selection */}
              <div className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#464555] uppercase tracking-wider">Data Inicial</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={filterStartDate} 
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full bg-[#f2f4f6] text-xs py-2 px-3 rounded-lg outline-none border border-[#eceef0] font-sans font-medium text-[#191c1e] cursor-pointer focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#464555] uppercase tracking-wider">Data Final</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={filterEndDate} 
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full bg-[#f2f4f6] text-xs py-2 px-3 rounded-lg outline-none border border-[#eceef0] font-sans font-medium text-[#191c1e] cursor-pointer focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#464555] uppercase tracking-wider">Liderança</label>
                  <select 
                    value={filterLeader}
                    onChange={(e) => setFilterLeader(e.target.value)}
                    className="w-full bg-[#f2f4f6] text-xs py-2 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                  >
                    <option>Todas as Lideranças</option>
                    {leaders.map(l => (
                      <option key={l.id} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#464555] uppercase tracking-wider">Categoria de Atendimento</label>
                  <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full bg-[#f2f4f6] text-xs py-2 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                  >
                    <option>Todas as Categorias</option>
                    {CATEGORIES_LIST.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Layout of report graphics in order: Line Performance, Pie Categoria, Pie Região */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* 1. Core Dynamic Graphic Line Performance Chart */}
                <div className="xl:col-span-6 bg-white p-6 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-[#191c1e] uppercase tracking-wider">{performanceChartData.title}</h3>
                      <p className="text-xs text-[#777587]">
                        {performanceChartData.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#464555]">Filtrar:</span>
                      <select 
                        value={performancePeriod}
                        onChange={(e) => {
                          setPerformancePeriod(e.target.value as 'Diário' | 'Semanal' | 'Mensal');
                          setHoveredPointIndex(null);
                        }}
                        className="bg-[#f2f4f6] border-none rounded-lg text-xs py-1.5 px-3 outline-none text-[#191c1e] font-semibold cursor-pointer hover:bg-[#eceef0] transition-colors"
                      >
                        <option value="Diário">Diário (Últimos 15 Dias)</option>
                        <option value="Semanal">Semanal (Últimas 8 Semanas)</option>
                        <option value="Mensal">Mensal (Últimos 12 Meses)</option>
                      </select>
                    </div>
                  </div>

                  {/* Responsive interactive SVG Line Chart */}
                  <div className="relative w-full h-48 pt-3 select-none">
                    {(() => {
                      const wVal = 600;
                      const hVal = 180;
                      const padLeft = 10;
                      const padRight = 10;
                      const padTop = 15;
                      const padBottom = 25;
                      
                      const activeW = wVal - padLeft - padRight;
                      const activeH = hVal - padTop - padBottom;
                      
                      const maxVal = Math.max(...performanceChartData.points.map(p => p.count), 1);
                      
                      const pointsPositions = performanceChartData.points.map((p, index) => {
                        const x = padLeft + (index * (activeW / (performanceChartData.points.length - 1)));
                        const y = (hVal - padBottom) - ((p.count / maxVal) * activeH);
                        return { x, y, label: p.label, count: p.count };
                      });
                      
                      // Construct stroke line path
                      const pathD = pointsPositions.reduce((acc, curr, index) => {
                        return index === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                      }, '');
                      
                      // Construct gradient area path
                      const areaD = pointsPositions.length > 0 
                        ? `${pathD} L ${pointsPositions[pointsPositions.length - 1].x} ${hVal - padBottom} L ${pointsPositions[0].x} ${hVal - padBottom} Z`
                        : '';

                      return (
                        <>
                          <svg viewBox={`0 0 ${wVal} ${hVal}`} className="w-full h-full overflow-visible">
                            <defs>
                              {/* Glowing blue line gradient */}
                              <linearGradient id="chartGradientReport" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3525cd" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#3525cd" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Horizontal grid guide lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                              const yLine = padTop + (activeH * ratio);
                              return (
                                <line 
                                  key={i} 
                                  x1={padLeft} 
                                  y1={yLine} 
                                  x2={wVal - padRight} 
                                  y2={yLine} 
                                  stroke="#f2f4f6" 
                                  strokeWidth="1" 
                                  strokeDasharray="3 3"
                                />
                              );
                            })}

                            {/* Area layout fill */}
                            {areaD && (
                              <path 
                                d={areaD} 
                                fill="url(#chartGradientReport)" 
                                className="transition-all duration-500 ease-in-out"
                              />
                            )}

                            {/* Line stroke */}
                            {pathD && (
                              <path 
                                d={pathD} 
                                fill="none" 
                                stroke="#3525cd" 
                                strokeWidth="3" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="transition-all duration-500 ease-in-out"
                              />
                            )}

                            {/* Horizontal X Axis labels */}
                            {pointsPositions.map((p, i) => (
                              <text 
                                key={i} 
                                x={p.x} 
                                y={hVal - 5} 
                                textAnchor={i === 0 ? "start" : i === pointsPositions.length - 1 ? "end" : "middle"} 
                                className={`text-[10px] font-bold font-sans ${hoveredPointIndex === i ? 'fill-[#3525cd]' : 'fill-[#777587]'}`}
                              >
                                {p.label}
                              </text>
                            ))}

                            {/* Invisible interaction bars for easy cursor landing */}
                            {pointsPositions.map((p, i) => {
                              const colWidth = activeW / (performanceChartData.points.length - 1);
                              return (
                                <rect 
                                  key={i}
                                  x={p.x - colWidth / 2}
                                  y={padTop}
                                  width={colWidth}
                                  height={activeH + 10}
                                  fill="transparent"
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPointIndex(i)}
                                  onMouseLeave={() => setHoveredPointIndex(null)}
                                />
                              );
                            })}

                            {/* Interactive indicators/circles */}
                            {pointsPositions.map((p, i) => (
                              <circle 
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={hoveredPointIndex === i ? 6 : 4}
                                fill={hoveredPointIndex === i ? '#3525cd' : '#ffffff'}
                                stroke="#3525cd"
                                strokeWidth={hoveredPointIndex === i ? 2 : 2.5}
                                className="transition-all duration-150 pointer-events-none"
                              />
                            ))}
                          </svg>

                          {/* Hover tooltip widget overlay */}
                          {hoveredPointIndex !== null && pointsPositions[hoveredPointIndex] && (
                            <div 
                              className="absolute z-20 pointer-events-none bg-[#181445] text-white text-[11px] font-sans rounded-lg px-2.5 py-1.5 shadow-xl border border-white/10 flex flex-col min-w-[100px] transition-all duration-155 animate-fade-in"
                              style={{
                                left: `${(pointsPositions[hoveredPointIndex].x / wVal) * 100}%`,
                                top: `${(pointsPositions[hoveredPointIndex].y / hVal) * 100 - 32}%`,
                                transform: 'translateX(-50%)',
                              }}
                            >
                              <span className="font-bold text-[9px] text-[#a5b4fc] tracking-widest uppercase">{pointsPositions[hoveredPointIndex].label}</span>
                              <span className="font-extrabold text-[#ffffff] mt-0.5">{pointsPositions[hoveredPointIndex].count} cadastros</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex justify-between items-center text-xs mt-4">
                    <span className="text-[#464555]">
                      Média registrada do período: <strong className="text-[#191c1e]">{performanceChartData.avg}</strong>
                    </span>
                    <span className={`px-3 py-1 rounded-full font-bold text-[#166534] bg-[#dcfce7]`}>
                      {performanceChartData.growth}
                    </span>
                  </div>
                </div>

                {/* 2. Category Pie Chart */}
                <div className="xl:col-span-3 bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  {(() => {
                    const total = categoriesWithCount.reduce((sum, item) => sum + item.count, 0);
                    let accumulatedPercent = 0;
                    const colors = [
                      '#3525cd', '#10b981', '#f59e0b', '#ec4899', 
                      '#3b82f6', '#8b5cf6', '#14b8a6', '#06b6d4'
                    ];

                    return (
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#191c1e] uppercase tracking-wider">Por Categoria</h3>
                          <p className="text-[10px] text-[#777587] font-medium leading-tight mt-0.5">Participação volumétrica por categoria de atendimento.</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center space-y-4 py-4 my-auto">
                          {total === 0 ? (
                            <div className="text-xs text-[#777587] py-12 text-center font-medium font-sans">Sem cadastros para o filtro.</div>
                          ) : (
                            <>
                              <div className="relative w-32 h-32 flex-shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                  <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f2f4f6" strokeWidth="12" />
                                  {categoriesWithCount.map((item, idx) => {
                                    const percent = (item.count / total) * 100;
                                    const dashArray = `${percent * 1.885} 188.5`;
                                    const dashOffset = -(accumulatedPercent * 1.885);
                                    accumulatedPercent += percent;
                                    const color = colors[idx % colors.length];

                                    return (
                                      <circle
                                        key={idx}
                                        cx="50"
                                        cy="50"
                                        r="30"
                                        fill="transparent"
                                        stroke={color}
                                        strokeWidth="12"
                                        strokeDasharray={dashArray}
                                        strokeDashoffset={dashOffset}
                                        className="transition-all duration-500 ease-in-out hover:stroke-opacity-80"
                                      />
                                    );
                                  })}
                                  <circle cx="50" cy="50" r="24" fill="#ffffff" />
                                  <g className="transform rotate-90 origin-center">
                                    <text x="50" y="48" textAnchor="middle" className="text-[14px] font-extrabold fill-[#191c1e] font-sans">
                                      {total}
                                    </text>
                                    <text x="50" y="58" textAnchor="middle" className="text-[6px] font-bold fill-[#777587] uppercase tracking-wider">
                                      Total
                                    </text>
                                  </g>
                                </svg>
                              </div>

                              <div className="w-full space-y-1 max-h-36 overflow-y-auto pr-1 select-none">
                                {categoriesWithCount.map((item, idx) => {
                                  const percent = total > 0 ? (item.count / total) * 100 : 0;
                                  const color = colors[idx % colors.length];
                                  return (
                                    <div key={idx} className="flex items-center justify-between text-[11px] text-[#464555]">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="w-2 rounded-full h-2 flex-shrink-0" style={{ backgroundColor: color }} />
                                        <span className="truncate font-semibold text-[#464555]" title={item.category}>{item.category}</span>
                                      </div>
                                      <span className="font-mono font-bold text-[#191c1e] ml-1 flex-shrink-0">
                                        {item.count} ({percent.toFixed(0)}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 3. Region Pie Chart */}
                <div className="xl:col-span-3 bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm flex flex-col justify-between">
                  {(() => {
                    const total = regionsWithCount.reduce((sum, item) => sum + item.count, 0);
                    let accumulatedPercent = 0;
                    const colors = [
                      '#4f46e5', '#0ea5e9', '#e11d48', '#f59e0b',
                      '#10b981', '#a855f7', '#14b8a6', '#f43f5e'
                    ];

                    return (
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#191c1e] uppercase tracking-wider">Por Região</h3>
                          <p className="text-[10px] text-[#777587] font-medium leading-tight mt-0.5">Distribuição geográfica setorial dos cadastros de campo.</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center space-y-4 py-4 my-auto">
                          {total === 0 ? (
                            <div className="text-xs text-[#777587] py-12 text-center font-medium font-sans">Sem cadastros para o filtro.</div>
                          ) : (
                            <>
                              <div className="relative w-32 h-32 flex-shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                  <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f2f4f6" strokeWidth="12" />
                                  {regionsWithCount.map((item, idx) => {
                                    const percent = (item.count / total) * 100;
                                    const dashArray = `${percent * 1.885} 188.5`;
                                    const dashOffset = -(accumulatedPercent * 1.885);
                                    accumulatedPercent += percent;
                                    const color = colors[idx % colors.length];

                                    return (
                                      <circle
                                        key={idx}
                                        cx="50"
                                        cy="50"
                                        r="30"
                                        fill="transparent"
                                        stroke={color}
                                        strokeWidth="12"
                                        strokeDasharray={dashArray}
                                        strokeDashoffset={dashOffset}
                                        className="transition-all duration-500 ease-in-out hover:stroke-opacity-80"
                                      />
                                    );
                                  })}
                                  <circle cx="50" cy="50" r="24" fill="#ffffff" />
                                  <g className="transform rotate-90 origin-center">
                                    <text x="50" y="48" textAnchor="middle" className="text-[14px] font-extrabold fill-[#191c1e] font-sans">
                                      {total}
                                    </text>
                                    <text x="50" y="58" textAnchor="middle" className="text-[6px] font-bold fill-[#777587] uppercase tracking-wider">
                                      Total
                                    </text>
                                  </g>
                                </svg>
                              </div>

                              <div className="w-full space-y-1 max-h-36 overflow-y-auto pr-1 select-none">
                                {regionsWithCount.map((item, idx) => {
                                  const percent = total > 0 ? (item.count / total) * 100 : 0;
                                  const color = colors[idx % colors.length];
                                  return (
                                    <div key={idx} className="flex items-center justify-between text-[11px] text-[#464555]">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="w-2 rounded-full h-2 flex-shrink-0" style={{ backgroundColor: color }} />
                                        <span className="truncate font-semibold text-[#464555]" title={item.region}>{item.region}</span>
                                      </div>
                                      <span className="font-mono font-bold text-[#191c1e] ml-1 flex-shrink-0">
                                        {item.count} ({percent.toFixed(0)}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>

            </div>
          )}

          {/* USER PROFILE SCREEN VIEW */}
          {activeView === 'perfil' && (
            <div className="space-y-8 animate-fade-in text-left">
              <div className="bg-white rounded-2xl overflow-hidden border border-[#eceef0] shadow-sm">
                <div className="h-32 bg-gradient-to-r from-[#3525cd] to-[#4f46e5]" />
                <div className="px-6 pb-6 flex flex-col md:flex-row items-end gap-6 -mt-12">
                  <div className="relative">
                    <img 
                      src={profile.avatarUrl} 
                      alt="Profile Avatar" 
                      className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-md"
                    />
                    <button 
                      onClick={() => {
                        triggerNotification('Simulação: Upload de avatar completado!', 'success');
                      }}
                      className="absolute bottom-1 right-1 bg-[#3525cd] text-white p-2 rounded-lg hover:scale-105 active:scale-95 transition-transform shrink-0 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="flex-grow pb-2 text-center md:text-left">
                    <h2 className="text-2xl font-bold text-[#191c1e] leading-tight">{profile.name}</h2>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-1 text-xs text-[#777587]">
                      <span className="bg-[#f2f4f6] text-[#3323cc] font-bold px-2.5 py-1 rounded">Administrador Master</span>
                      <span>• São Paulo, Brasil</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pb-2">
                    <button 
                      onClick={() => handleExport('PDF')}
                      className="border border-[#c7c4d8] text-[#191c1e] hover:bg-[#f2f4f6] px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Relatório de Atividade</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid Layout profile data */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Information inputs details */}
                <div className="lg:col-span-2 space-y-6">
                  
                  <div className="bg-white p-6 rounded-2xl border border-[#eceef0] shadow-sm">
                    <h3 className="text-[#191c1e] text-sm font-bold uppercase tracking-wider mb-6 flex items-center gap-2.5">
                      <User className="w-5 h-5 text-[#3525cd]" />
                      <span>Informações Pessoais</span>
                    </h3>

                    <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-xs text-left">
                        <label className="font-semibold block text-[#464555]">Nome Completo</label>
                        <input 
                          type="text" 
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2.5 px-4 outline-none text-sm focus:border-[#4f46e5]"
                        />
                      </div>

                      <div className="space-y-1.5 text-xs text-left">
                        <label className="font-semibold block text-[#464555]">E-mail Corporativo</label>
                        <input 
                          type="email" 
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2.5 px-4 outline-none text-sm focus:border-[#4f46e5]"
                        />
                      </div>

                      <div className="space-y-1.5 text-xs text-left">
                        <label className="font-semibold block text-[#464555]">Telefone / WhatsApp</label>
                        <input 
                          type="text" 
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: maskPhone(e.target.value) })}
                          maxLength={15}
                          className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2.5 px-4 outline-none text-sm focus:border-[#4f46e5]"
                        />
                      </div>

                      <div className="space-y-1.5 text-xs text-left">
                        <label className="font-semibold block text-[#464555]">Cadastro de Pessoa Física (CPF)</label>
                        <input 
                          type="text" 
                          value={profile.cpf}
                          readOnly
                          className="w-full bg-[#eceef0] border border-[#eceef0] text-[#777587] rounded-lg py-2.5 px-4 outline-none text-sm cursor-not-allowed"
                        />
                      </div>

                      <div className="md:col-span-2 pt-2 text-right">
                        <button 
                          type="submit"
                          className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow transition-colors"
                        >
                          Salvar Alterações
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Security configurations */}
                  <div className="bg-white p-6 rounded-2xl border border-[#eceef0] shadow-sm">
                    <h3 className="text-[#191c1e] text-sm font-bold uppercase tracking-wider mb-6 flex items-center gap-2.5">
                      <LockOpen className="w-5 h-5 text-[#ba1a1a]" />
                      <span>Configurações de Segurança</span>
                    </h3>

                    <form onSubmit={handleSaveSecurity} className="space-y-4 max-w-lg text-left">
                      <div className="space-y-1.5 text-xs">
                        <label className="font-semibold block text-[#464555]">Senha Atual</label>
                        <input 
                          type="password"
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2.5 px-4 outline-none text-sm focus:border-[#4f46e5]"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-xs">
                          <label className="font-semibold block text-[#464555]">Nova Senha</label>
                          <input 
                            type="password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2.5 px-4 outline-none text-sm"
                            placeholder="Mínimo 8 dígitos"
                          />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <label className="font-semibold block text-[#464555]">Confirmar Nova Senha</label>
                          <input 
                            type="password"
                            value={confirmNewPass}
                            onChange={(e) => setConfirmNewPass(e.target.value)}
                            className="w-full bg-[#f2f4f6] border border-[#eceef0] rounded-lg py-2.5 px-4 outline-none text-sm"
                            placeholder="Mínimo 8 dígitos"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-[#777587]">
                        A nova senha de auditoria deve conter no mínimo 8 caracteres, incluindo letras, números e símbolos especiais.
                      </p>

                      <div className="pt-2 text-right">
                        <button 
                          type="submit"
                          className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow transition-colors"
                        >
                          Redefinir Senha
                        </button>
                      </div>
                    </form>
                  </div>

                </div>

                {/* Right widgets actions columns */}
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-[#eceef0] shadow-sm space-y-4 text-left">
                    <h4 className="text-xs font-bold text-[#191c1e] uppercase tracking-wider mb-2">Ações Administrativas</h4>
                    <button 
                      onClick={() => {
                        if (confirm('Deseja realmente redefinir todos os dados de simulação ao padrão de fábrica?')) {
                          localStorage.clear();
                          window.location.reload();
                        }
                      }}
                      className="w-full text-center py-2.5 px-4 border border-[#c7c4d8] hover:bg-[#fee2e2] text-[#ba1a1a] hover:border-[#ba1a1a]/20 font-semibold text-xs rounded-lg transition-colors"
                    >
                      Restaurar Banco de Dados
                    </button>
                    <button 
                      onClick={() => handleLogout()}
                      className="w-full text-center py-2.5 px-4 bg-[#ba1a1a] text-white font-semibold text-xs rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Excluir Conta Permanente
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      {/* 4. MODALS CONTAINER */}
      
      {/* Dynamic Member Add Form Modal */}
      {showAddRegistrationModal && (
        <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-lg w-full overflow-hidden text-left animate-fade-in animate-scale-up">
            <div className="p-6 bg-[#3525cd] text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg leading-tight">Registrar Novo Membro</h3>
                <p className="text-[#c4c1fb] text-xs">Preencha o formulário e associe-o a um líder.</p>
              </div>
              <button onClick={() => setShowAddRegistrationModal(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitNewRegistration} className="p-6 space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Liderança de Campo Responsável</label>
                <select 
                  value={newRegistrationLeader}
                  onChange={(e) => setNewRegistrationLeader(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                >
                  {leaders.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Categoria de Atendimento</label>
                <select 
                  value={newRegistrationCategory}
                  onChange={(e) => setNewRegistrationCategory(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                >
                  {CATEGORIES_LIST.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Inputs mapped from Form Builder */}
              <div className="h-[2px] bg-[#eceef0] my-4" />
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {formFields.map((field) => {
                  if (field.type === 'h2') {
                    return <h4 key={field.id} className="text-xs font-bold uppercase tracking-wider border-b pb-1 pt-2">{field.label}</h4>;
                  }
                  if (field.type === 'p') {
                    return <p key={field.id} className="text-[10px] text-[#777587] leading-tight">{field.label}</p>;
                  }

                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="block text-xs font-semibold text-[#191c1e]">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select 
                          required={field.required}
                          value={dynamicFormInput[field.id] || ''}
                          onChange={(e) => setDynamicFormInput({ ...dynamicFormInput, [field.id]: e.target.value })}
                          className="w-full bg-[#f2f4f6] text-xs py-2 px-3 rounded-lg border border-[#eceef0] outline-none"
                        >
                          <option value="">Selecione uma opção...</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type={field.type === 'email' ? 'email' : 'text'}
                          required={field.required}
                          maxLength={field.type === 'cpf' ? 14 : field.type === 'tel' ? 15 : undefined}
                          placeholder={field.placeholder || ''}
                          value={dynamicFormInput[field.id] || ''}
                          onChange={(e) => {
                            let value = e.target.value;
                            if (field.type === 'cpf') {
                              value = maskCPF(value);
                            } else if (field.type === 'tel') {
                              value = maskPhone(value);
                            }
                            setDynamicFormInput({ ...dynamicFormInput, [field.id]: value });
                          }}
                          className="w-full bg-[#f2f4f6] text-xs py-2 px-3 rounded-lg border border-[#eceef0] outline-none focus:bg-white"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-[#eceef0] flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddRegistrationModal(false)}
                  className="px-4 py-2 border border-[#c7c4d8] text-xs font-semibold rounded-lg hover:bg-[#f2f4f6]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-lg"
                >
                  Gravar Cadastro
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* View Registration Detail Modal */}
      {viewingRegistration && (
        <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-md w-full overflow-hidden text-left animate-fade-in animate-scale-up">
            <div className="p-6 bg-[#181445] text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg leading-tight">Visualizar Cadastro</h3>
                <p className="text-[#c4c1fb] text-xs">Informações detalhadas do registro selecionado.</p>
              </div>
              <button onClick={() => setViewingRegistration(null)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 font-sans">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ID de Controle</span>
                  <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold">{viewingRegistration.id}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Nome Completo</span>
                  <p className="text-base font-bold text-[#191c1e]">{viewingRegistration.name}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Liderança de Campo</span>
                  <p className="text-sm font-semibold text-[#3525cd]">{viewingRegistration.leaderName}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Categoria de Atendimento</span>
                  <div>
                    <span className="inline-block bg-[#e2dfff] text-[#3323cc] text-xs font-bold font-mono px-3 py-1 rounded-full uppercase tracking-wider">
                      {viewingRegistration.category}
                    </span>
                  </div>
                </div>



                {formFields
                  .filter(field => field.id !== 'f1' && field.type !== 'h2' && field.type !== 'p')
                  .map((field) => {
                    const value = viewingRegistration[field.id];
                    const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
                    return (
                      <div key={field.id} className="space-y-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                          {field.label}
                        </span>
                        {hasValue ? (
                          <p className="text-sm font-semibold text-[#191c1e]">{String(value)}</p>
                        ) : (
                          <p className="text-sm font-bold text-[#ba1a1a]">Não coletado</p>
                        )}
                      </div>
                    );
                  })}

                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Data de Registro/Coleta</span>
                  <p className="text-xs font-mono text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">{viewingRegistration.date}</p>
                </div>
              </div>

              <div className="pt-5 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    const regToEdit = viewingRegistration;
                    setViewingRegistration(null);
                    handleEditRegistrationClick(regToEdit);
                  }}
                  className="px-4 py-2 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar Registro</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setViewingRegistration(null)}
                  className="px-4 py-2 border border-[#c7c4d8] text-xs font-semibold rounded-lg hover:bg-[#f2f4f6]"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Registration Modal */}
      {editingRegistration && (
        <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-md w-full overflow-hidden text-left animate-fade-in animate-scale-up">
            <div className="p-6 bg-[#3525cd] text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg leading-tight">Editar Cadastro</h3>
                <p className="text-[#c4c1fb] text-xs">Atualize os dados principais do membro registrado.</p>
              </div>
              <button 
                onClick={() => setEditingRegistration(null)} 
                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRegistrationEdit} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  value={editRegName}
                  onChange={(e) => setEditRegName(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-medium focus:bg-white text-[#191c1e]"
                  placeholder="Nome do cadastrado..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Liderança de Campo Responsável</label>
                <select 
                  value={editRegLeaderId}
                  onChange={(e) => setEditRegLeaderId(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                >
                  {leaders.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Categoria de Atendimento</label>
                <select 
                  value={editRegCategory}
                  onChange={(e) => setEditRegCategory(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                >
                  {editRegCategory && !CATEGORIES_LIST.includes(editRegCategory) && (
                    <option value={editRegCategory}>{editRegCategory}</option>
                  )}
                  {CATEGORIES_LIST.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {formFields
                .filter(field => field.id !== 'f1' && field.type !== 'h2' && field.type !== 'p')
                .map((field) => {
                  return (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={editRegDynamicFields[field.id] || ''}
                          onChange={(e) => setEditRegDynamicFields({ ...editRegDynamicFields, [field.id]: e.target.value })}
                          className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-semibold text-[#191c1e]"
                        >
                          <option value="">Selecione...</option>
                          {field.options?.map((opt, idx) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'cpf' ? 'text' : field.type}
                          maxLength={field.type === 'cpf' ? 14 : field.type === 'tel' ? 15 : undefined}
                          placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                          value={editRegDynamicFields[field.id] || ''}
                          onChange={(e) => {
                            let value = e.target.value;
                            if (field.type === 'cpf') {
                              value = maskCPF(value);
                            } else if (field.type === 'tel') {
                              value = maskPhone(value);
                            }
                            setEditRegDynamicFields({ ...editRegDynamicFields, [field.id]: value });
                          }}
                          className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none font-medium focus:bg-white text-[#191c1e]"
                        />
                      )}
                    </div>
                  );
                })}

              <div className="pt-4 border-t border-[#eceef0] flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingRegistration(null)}
                  className="px-4 py-2 border border-[#c7c4d8] text-xs font-semibold rounded-lg hover:bg-[#f2f4f6]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-lg"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Primary Leader Add/Edit Modal */}
      {showAddLeaderModal && (
        <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-md w-full overflow-hidden text-left animate-fade-in animate-scale-up">
            <div className="p-6 bg-[#3525cd] text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  {editingLeader ? 'Editar Informações do Líder' : 'Nova Liderança de Campo'}
                </h3>
                <p className="text-[#c4c1fb] text-xs">Insira os dados cadastrais da credencial de campo.</p>
              </div>
              <button 
                onClick={() => {
                  setShowAddLeaderModal(false);
                  setEditingLeader(null);
                }} 
                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOrEditLeader} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  value={newLeaderName}
                  onChange={(e) => setNewLeaderName(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none"
                  placeholder="Ex: Carlos Alberto Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">E-mail de Login Corporativo</label>
                <input 
                  type="email" 
                  required
                  value={newLeaderEmail}
                  onChange={(e) => setNewLeaderEmail(e.target.value)}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none"
                  placeholder="Ex: carlos@lider.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  value={newLeaderPhone}
                  onChange={(e) => setNewLeaderPhone(maskPhone(e.target.value))}
                  maxLength={15}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none"
                  placeholder="Ex: (11) 98888-7777"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] uppercase tracking-wider mb-1.5">CPF do Líder</label>
                <input 
                  type="text" 
                  required
                  value={newLeaderCPF}
                  onChange={(e) => setNewLeaderCPF(maskCPF(e.target.value))}
                  className="w-full bg-[#f2f4f6] text-xs py-2.5 px-3 rounded-lg border border-[#eceef0] outline-none focus:bg-white transition-all font-mono"
                  placeholder="Ex: 000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div className="pt-4 border-t border-[#eceef0] flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddLeaderModal(false);
                    setEditingLeader(null);
                  }}
                  className="px-4 py-2 border border-[#c7c4d8] text-xs font-semibold rounded-lg hover:bg-[#f2f4f6]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-lg"
                >
                  {editingLeader ? 'Salvar Edições' : 'Criar Líder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leader's specialized QR view modal overlay */}
      {viewingLeaderQR && (() => {
        const leaderCollectionLink = `cadastros.com/${viewingLeaderQR.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')}`;
        return (
          <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-sm w-full overflow-hidden text-center animate-fade-in">
              <div className="p-6 bg-[#181445] text-white flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm tracking-tight block leading-none">Canal de Coleta Exclusivo</h3>
                  <span className="text-xs text-[#c4c1fb] font-mono">{viewingLeaderQR.name}</span>
                </div>
                <button onClick={() => setViewingLeaderQR(null)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center justify-center space-y-6">
                <p className="text-xs text-[#464555] leading-relaxed">
                  Este QR Code atribui os novos cadastrados diretamente à liderança de <strong className="text-[#191c1e]">{viewingLeaderQR.name}</strong> para auditorias de comissão e controle.
                </p>
                
                <div className="w-48 h-48 bg-white p-2 border border-[#c7c4d8] rounded-2xl shadow-sm flex items-center justify-center overflow-hidden">
                  <QRCodeImage text={leaderCollectionLink} size={180} className="w-full h-full object-contain" />
                </div>

                <div className="text-xs font-mono bg-[#f2f4f6] text-[#464555] py-2 px-4 rounded-xl select-all w-full truncate border">
                  {leaderCollectionLink}
                </div>

                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => {
                      handleCopyLink(leaderCollectionLink);
                      setViewingLeaderQR(null);
                    }}
                    className="flex-1 bg-[#3525cd] text-white py-2.5 rounded-xl font-bold text-xs shadow hover:bg-[#4f46e5] transition-colors"
                  >
                    Copiar Link Relacionado
                  </button>
                  <button 
                    onClick={() => {
                      handleDownloadPersonalQR(leaderCollectionLink, `qr-code-${viewingLeaderQR.name.toLowerCase().replace(/\s+/g, '-')}.png`);
                    }}
                    className="bg-[#f2f4f6] text-[#464555] px-3.5 py-2.5 rounded-xl border border-[#eceef0] hover:bg-[#eceef0] transition-colors"
                    title="Baixar QR Code como PNG"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {renderNotificationBanner()}

      {/* Custom Deletion Confirmation Modals */}
      {registrationToDelete && (
        <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-sm w-full overflow-hidden text-left animate-fade-in animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-[#191c1e] mb-2">Confirmar Exclusão</h3>
              <p className="text-sm text-[#777587] mb-6">
                Deseja realmente remover o cadastro de <strong className="text-[#191c1e]">{registrationToDelete.name}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setRegistrationToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-[#c7c4d8] text-xs font-semibold rounded-xl hover:bg-[#f2f4f6] text-[#464555] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteRegistration}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {leaderToDelete && (
        <div className="fixed inset-0 bg-[#181445]/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eceef0] shadow-lg max-w-sm w-full overflow-hidden text-left animate-fade-in animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-[#191c1e] mb-2">Excluir Liderança</h3>
              <p className="text-sm text-[#777587] mb-6">
                Deseja realmente excluir a liderança de <strong className="text-[#191c1e]">{leaderToDelete.name}</strong>? Registros existentes não serão excluídos.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setLeaderToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-[#c7c4d8] text-xs font-semibold rounded-xl hover:bg-[#f2f4f6] text-[#464555] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteLeader}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
