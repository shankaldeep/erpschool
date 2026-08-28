import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Card, Button, Label, Input } from '../components/UI';
import { School, Building, Plus, Trash2, Download, Upload, FileJson, FileText, CheckCircle2, AlertTriangle, Edit, X, Copy, Check, Clock, RefreshCw, HardDrive, Database, ShieldCheck } from 'lucide-react';

export function MasterAdminPanel() {
  const { 
    schools, 
    users, 
    addSchool, 
    updateSchool,
    updateSchoolFeatures,
    deleteSchool, 
    activeAcademicSession, 
    setActiveAcademicSession, 
    students, 
    allStudents,
    allMarks,
    allFeeRecords,
    attendances,
    deleteAllStudentsInSchool,
    feeRecords, 
    academicSessions, 
    allowedSessions, 
    setAllowedSessions,
    sessionRequests,
    approveSessionRequest,
    deleteSessionRequest,
    createLocalBackupSnapshot,
    restoreFromLocalBackupSnapshot,
    exportFullDiskBackup,
    importFullDiskBackup,
    localBackups,
    importStudents,
    importMarks,
    saveAttendance,
    importFeeRecords,
    schoolConfigs,
    classFeesData,
    saveSchoolConfig,
    saveSchoolFees
  } = useStore();
  
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newSchoolMobile, setNewSchoolMobile] = useState('');
  const [newSchoolAltMobile, setNewSchoolAltMobile] = useState('');
  const [newSchoolUdise, setNewSchoolUdise] = useState('');
  const [newSchoolLogo, setNewSchoolLogo] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');

  const [pendingFeaturesMap, setPendingFeaturesMap] = useState<Record<string, string[]>>({});

  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [schoolEditForm, setSchoolEditForm] = useState<any>({});

  // Session Config States
  const [sessionConfigTarget, setSessionConfigTarget] = useState('2026-27');
  const [showFullSessionsGrid, setShowFullSessionsGrid] = useState(false);

  // Sync Hub State
  const [syncSchoolId, setSyncSchoolId] = useState('');
  const [syncCategory, setSyncCategory] = useState<'students' | 'profile' | 'gdrive'>('students');
  const [importStatus, setImportStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const fullDiskInputRef = useRef<HTMLInputElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  // Local Offline Backup & Restore handlers
  const handleImmediateLocalBackup = () => {
    if (!syncSchoolId) {
      alert("Please choose a target school first.");
      return;
    }
    const schoolName = schools.find(s => s.id === syncSchoolId)?.name || 'Selected School';
    setIsSyncing(true);
    setImportStatus('Creating secure offline local snapshot...');

    try {
      const snapshot = createLocalBackupSnapshot(syncSchoolId);
      setImportStatus(`Successfully created and saved local offline restore point (${snapshot.id})! Total records protected: ${snapshot.studentsCount + snapshot.marksCount + snapshot.attendancesCount + snapshot.feeRecordsCount}`);
    } catch (error: any) {
      setImportStatus(`Failed to create local snapshot: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromLocalSnapshot = (snapshotDocId: string, rawSnapshotStr?: string) => {
    if (!window.confirm("Are you absolutely sure you want to restore this local snapshot? All current student profiles, marks, attendance, and fees for this school will be updated with the backup snapshot.")) {
      return;
    }

    setIsSyncing(true);
    setImportStatus('Restoring school data from local snapshot...');

    try {
      const count = restoreFromLocalBackupSnapshot(snapshotDocId, rawSnapshotStr);
      setImportStatus(`Success! Successfully restored ${count} total records from local snapshot into active workspace.`);
    } catch (error: any) {
      setImportStatus(`Failed to restore local snapshot: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Exporters & Importers
  const handleExportStudents = () => {
    const targetStudents = allStudents.filter(s => s.schoolId === syncSchoolId);
    const targetMarks = allMarks.filter(m => m.schoolId === syncSchoolId);
    const targetAttendances = attendances.filter(a => a.schoolId === syncSchoolId);
    const targetFeeRecords = allFeeRecords.filter(f => f.schoolId === syncSchoolId);

    if (targetStudents.length === 0 && targetMarks.length === 0 && targetAttendances.length === 0 && targetFeeRecords.length === 0) {
      alert("No data records (students, marks, attendance, or fees) found under this school to export.");
      return;
    }

    const schoolName = schools.find(s => s.id === syncSchoolId)?.name || 'school';
    
    // Create a fully qualified full-system backup package
    const backupPackage = {
      type: "school_full_backup",
      schoolId: syncSchoolId,
      schoolName: schoolName,
      exportedAt: new Date().toISOString(),
      students: targetStudents,
      marks: targetMarks,
      attendances: targetAttendances,
      feeRecords: targetFeeRecords
    };

    const jsonStr = JSON.stringify(backupPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_full_${schoolName.toLowerCase().replace(/[^a-z0-9.]+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportStatus(`Successfully exported complete backup of ${schoolName} (Students: ${targetStudents.length}, Marks: ${targetMarks.length}, Attendance: ${targetAttendances.length}, Fees: ${targetFeeRecords.length}).`);
  };

  const handleImportStudents = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setImportStatus('Reading backup file...');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        let successStudents = 0;
        let successMarks = 0;
        let successAttendances = 0;
        let successFeeRecords = 0;

        if (parsed && parsed.type === "school_full_backup") {
          setImportStatus('Restoring full backup (Students, Marks, Attendance, Fees)...');
          
          // 1. Restore Students
          if (Array.isArray(parsed.students) && parsed.students.length > 0) {
            const cleanStudents = parsed.students
              .filter((raw: any) => raw && raw.name)
              .map((raw: any) => ({
                ...raw,
                id: raw.id || `s_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
                schoolId: syncSchoolId,
                role: 'STUDENT',
                feeBalance: Number(raw.feeBalance) || 0,
                academicSession: raw.academicSession || activeAcademicSession || '2026-27'
              }));
            await importStudents(cleanStudents);
            successStudents = cleanStudents.length;
          }

          // 2. Restore Marks (Results)
          if (Array.isArray(parsed.marks) && parsed.marks.length > 0) {
            const cleanMarks = parsed.marks
              .filter((m: any) => m && m.id)
              .map((m: any) => ({
                ...m,
                schoolId: syncSchoolId
              }));
            await importMarks(cleanMarks);
            successMarks = cleanMarks.length;
          }

          // 3. Restore Attendances
          if (Array.isArray(parsed.attendances) && parsed.attendances.length > 0) {
            for (const a of parsed.attendances) {
              if (!a.id) continue;
              await saveAttendance({
                ...a,
                schoolId: syncSchoolId
              });
              successAttendances++;
            }
          }

          // 4. Restore Fee Records
          if (Array.isArray(parsed.feeRecords) && parsed.feeRecords.length > 0) {
            const cleanFees = parsed.feeRecords
              .filter((f: any) => f && f.id)
              .map((f: any) => ({
                ...f,
                schoolId: syncSchoolId
              }));
            await importFeeRecords(cleanFees);
            successFeeRecords = cleanFees.length;
          }

          setImportStatus(`Success! Fully restored school backup to local disk: ${successStudents} Students, ${successMarks} Marks, ${successAttendances} Attendances, and ${successFeeRecords} Fee Records are active.`);
          setImportedCount(successStudents + successMarks + successAttendances + successFeeRecords);

        } else if (Array.isArray(parsed)) {
          // Old student-only list backup
          setImportStatus('Restoring old-style student-only backup...');
          const cleanStudents = parsed
            .filter((raw: any) => raw && raw.name)
            .map((raw: any) => ({
              ...raw,
              id: raw.id || `s_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
              schoolId: syncSchoolId,
              role: 'STUDENT',
              feeBalance: Number(raw.feeBalance) || 0,
              academicSession: raw.academicSession || activeAcademicSession || '2026-27'
            }));
          await importStudents(cleanStudents);
          successStudents = cleanStudents.length;
          setImportStatus(`Success! Integrated and verified ${successStudents} student records under this school node.`);
          setImportedCount(successStudents);
        } else {
          throw new Error("Invalid format. The backup must be a full school backup package or an array of student records.");
        }
      } catch (err: any) {
        setImportStatus(`Error parsing JSON: ${err.message || 'Check structure compatibility.'}`);
      } finally {
        setIsSyncing(false);
        if (studentInputRef.current) studentInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportSchoolProfile = async () => {
    if (!syncSchoolId) return;
    setIsSyncing(true);
    setImportStatus('Compiling profile package from local storage...');
    
    try {
      const schoolRecord = schools.find(s => s.id === syncSchoolId);
      if (!schoolRecord) throw new Error("School metadata record not found.");

      // Fetch School Config mapping
      const configData = schoolConfigs[syncSchoolId] || null;

      // Fetch class fees mapping
      const feesData = classFeesData[syncSchoolId] || null;

      const profilePackage = {
        school: schoolRecord,
        config: configData,
        classFees: feesData,
        exportedAt: new Date().toISOString()
      };

      const jsonStr = JSON.stringify(profilePackage, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile_config_${schoolRecord.name.toLowerCase().replace(/[^a-z0-9.]+/g, '_')}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setImportStatus(`Successfully consolidated and exported core settings mapping for ${schoolRecord.name}.`);
    } catch (err: any) {
      setImportStatus(`Error exporting school profile: ${err.message || 'Storage export error.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportSchoolProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setImportStatus('Validating and writing system restore schema...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.school || !parsed.school.id) {
          throw new Error("Invalid schema structure. Core school metadata block is missing.");
        }

        const targetId = syncSchoolId; // Preserve current physical target slot
        
        // Overwrite standard school profile in local state
        const restoredSchool = {
          ...parsed.school,
          id: targetId,
          name: parsed.school.name || 'Restored School'
        };
        await updateSchool(targetId, restoredSchool);

        // Overwrite or create configs in local store
        if (parsed.config) {
          await saveSchoolConfig(targetId, {
            ...parsed.config,
            schoolId: targetId
          });
        }

        // Overwrite or create fees in local store
        if (parsed.classFees) {
          await saveSchoolFees(targetId, parsed.classFees);
        }

        setImportStatus(`Restoration process complete! Successfully synchronized settings, module activations, and fee blueprints for school ID: ${targetId}`);
        setImportedCount(3); // 3 Core tables rebuilt
      } catch (err: any) {
        setImportStatus(`Restoration aborted: ${err.message || 'JSON structure error.'}`);
      } finally {
        setIsSyncing(false);
        if (profileInputRef.current) profileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleToggleAllowedSession = (session: string) => {
    if (allowedSessions.includes(session)) {
      if (session === activeAcademicSession) {
        alert("Cannot lock/disallow the currently active academic session. Please switch the active session first.");
        return;
      }
      setAllowedSessions(allowedSessions.filter(s => s !== session));
    } else {
      setAllowedSessions([...allowedSessions, session]);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 200; // max 200px
        
        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/webp', 0.8);
          if (isEdit) {
            setSchoolEditForm((prev: any) => ({ ...prev, logo: compressedBase64 }));
          } else {
            setNewSchoolLogo(compressedBase64);
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSchoolName && adminEmail && adminPass && newSchoolAddress && newSchoolMobile && newSchoolUdise) {
      addSchool({
        name: newSchoolName,
        address: newSchoolAddress,
        mobile: newSchoolMobile,
        altMobile: newSchoolAltMobile,
        udiseCode: newSchoolUdise,
        logo: newSchoolLogo,
        adminEmail,
        adminPass
      });
      setNewSchoolName('');
      setNewSchoolAddress('');
      setNewSchoolMobile('');
      setNewSchoolAltMobile('');
      setNewSchoolUdise('');
      setNewSchoolLogo('');
      setAdminEmail('');
      setAdminPass('');
    } else {
      alert("Please fill all required fields (Name, Address, Mobile, UDISE, Email, Password).");
    }
  };

  const ALL_FEATURES = [
    { id: 'registration', label: 'Registration' },
    { id: 'fees', label: 'Fee Management' },
    { id: 'homework', label: 'Homework' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'marks', label: 'Marks/Results' },
    { id: 'tc', label: 'Transfer Cert' },
    { id: 'idcard', label: 'ID Cards' },
    { id: 'admitcards', label: 'Admit Cards' },
    { id: 'library', label: 'Library' },
    { id: 'hostel', label: 'Hostel' },
    { id: 'transport', label: 'Transport' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-6 overflow-x-auto">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mr-4">
            <Building className="w-5 h-5 text-indigo-600" />
            Global Platform Settings
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Label className="whitespace-nowrap mb-0 mr-2">Filter School:</Label>
              <Input as="select" value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)}>
                <option value="all">All Schools</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </Input>
            </div>
            <div className="flex items-center">
              <Label className="whitespace-nowrap mb-0 mr-2">Academic Session:</Label>
              <Input as="select" value={activeAcademicSession} onChange={e => setActiveAcademicSession(e.target.value)}>
                {academicSessions.map(session => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </Input>
            </div>
          </div>
        </div>

        {/* Allowed Sessions configuration panel */}
        <div className="mb-6 bg-indigo-50/55 p-4 rounded-xl border border-indigo-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100/50 pb-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                Session Permissions Control (सत्र अनुमति नियंत्रण)
              </h3>
              <p className="text-[11px] text-indigo-705 text-indigo-700/80">
                School administrators and staff are restricted from registering new records inside sessions globally disallowed/locked here.
              </p>
            </div>
            
            {/* Toggle Full Grid Display Button */}
            <button
              type="button"
              onClick={() => setShowFullSessionsGrid(!showFullSessionsGrid)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1 rounded transition-colors self-start md:self-auto"
            >
              {showFullSessionsGrid ? "Show Dropdown View (ड्रॉपडाउन देखें)" : "Show All Grid View (ग्रिड सूची देखें)"}
            </button>
          </div>

          {!showFullSessionsGrid ? (
            /* COMPACT DROPDOWN VIEW */
            <div className="flex flex-wrap items-center gap-4 bg-white/75 p-3 rounded-lg border border-indigo-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Select Academic Session:</span>
                <select
                  value={sessionConfigTarget}
                  onChange={(e) => setSessionConfigTarget(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {academicSessions.map((session) => (
                    <option key={session} value={session}>
                      Session {session} {allowedSessions.includes(session) ? "🔓 (Permitted)" : "🔒 (Locked)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                {allowedSessions.includes(sessionConfigTarget) ? (
                  <span className="bg-emerald-100 border border-emerald-200 text-emerald-850 text-emerald-800 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-black">
                    Authorized (सक्रिय)
                  </span>
                ) : (
                  <span className="bg-rose-100 border border-rose-200 text-rose-850 text-rose-800 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-black">
                    Locked / Blocked (अवरुद्ध)
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleToggleAllowedSession(sessionConfigTarget)}
                className={`md:ml-auto text-xs font-bold px-3 py-1 rounded transition-all shadow-sm ${
                  allowedSessions.includes(sessionConfigTarget)
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {allowedSessions.includes(sessionConfigTarget) ? "Block / Lock Session" : "Authorize / Allow Session"}
              </button>
            </div>
          ) : (
            /* EXPANDABLE FULL GRID LIST */
            <div className="flex flex-wrap gap-3">
              {academicSessions.map(session => (
                <label 
                  key={session} 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${
                    allowedSessions.includes(session)
                      ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={allowedSessions.includes(session)} 
                    onChange={() => handleToggleAllowedSession(session)} 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                  />
                  <span>Session {session}</span>
                  {allowedSessions.includes(session) ? (
                    <span className="bg-indigo-500 text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded text-indigo-100 font-bold">Allowed</span>
                  ) : (
                    <span className="bg-slate-100 text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded text-slate-400 font-bold">Locked</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Academic Session Approval Requests Panel */}
        <div className="mb-8 border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            Academic Session Approval Requests (सत्र स्वीकृति अनुरोध)
          </h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            School administrators submit requests for new Academic Sessions here. Approving a request instantly adds it to their permitted academic sessions, authorizing them to activate the workspace and register new students.
          </p>

          {sessionRequests.filter(req => req.status === 'Pending').length === 0 ? (
            <div className="text-center py-6 px-4 bg-white border border-slate-200 border-dashed rounded-lg">
              <p className="text-xs text-slate-500 italic">No pending academic session approval requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">School Name</th>
                    <th className="px-4 py-3">Requested Session</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3">Requested Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionRequests.filter(req => req.status === 'Pending').map(req => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{req.schoolName}</td>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600 bg-indigo-50/50">{req.session}</td>
                      <td className="px-4 py-3 text-slate-600">{req.requestedByEmail}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(req.requestedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Approve session "${req.session}" for school "${req.schoolName}"?`)) {
                                await approveSessionRequest(req.id);
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1.5 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            Approve (Aprob)
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to Delete/Reject request for "${req.session}" in school "${req.schoolName}"?`)) {
                                await deleteSessionRequest(req.id);
                              }
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-2.5 py-1.5 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Building className="w-5 h-5 text-indigo-600" />
          Register New School
        </h2>
        <form onSubmit={handleAddSchool} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 pb-6 mb-6">
          <div>
            <Label>School Name</Label>
            <Input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} required placeholder="Global Academy" />
          </div>
          <div>
            <Label>UDISE Code</Label>
            <Input value={newSchoolUdise} onChange={e => setNewSchoolUdise(e.target.value)} required placeholder="e.g. 0914... " />
          </div>
          <div>
            <Label>Mobile Number</Label>
            <Input value={newSchoolMobile} onChange={e => setNewSchoolMobile(e.target.value)} required placeholder="9876543210" />
          </div>
          <div>
            <Label>Alternate Mobile Number</Label>
            <Input value={newSchoolAltMobile} onChange={e => setNewSchoolAltMobile(e.target.value)} placeholder="0123456789 (Optional)" />
          </div>
          <div className="md:col-span-2">
            <Label>School Address</Label>
            <Input value={newSchoolAddress} onChange={e => setNewSchoolAddress(e.target.value)} required placeholder="Complete School Address Details" />
          </div>
          <div>
            <Label>Admin Initial Email</Label>
            <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required placeholder="admin@globalacademy.edu" />
          </div>
          <div>
            <Label>Admin Initial Password</Label>
            <Input value={adminPass} onChange={e => setAdminPass(e.target.value)} required placeholder="Temp Password" />
          </div>
          <div>
            <Label>School Logo <span className="text-[10px] text-slate-400 font-normal ml-1">(Square shape, Max 1MB)</span></Label>
            <Input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, false)} className="text-xs" />
            {newSchoolLogo && <img src={newSchoolLogo} alt="Logo Preview" className="h-10 mt-1 object-contain border rounded" />}
          </div>
          <div className="md:col-span-3 flex items-end justify-end">
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 w-full md:w-auto justify-center px-8">
              <Plus className="w-4 h-4" /> Register & Create Admin
            </Button>
          </div>
        </form>

        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <School className="w-5 h-5 text-indigo-600" />
          Active Schools Network
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">School Name</th>
                <th className="px-4 py-3 text-center">Total Students</th>
                <th className="px-4 py-3">Allowed Services (Features)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schools.filter(school => selectedSchoolId === 'all' || school.id === selectedSchoolId).map(school => {
                const schoolAdmins = users.filter(u => u.schoolId === school.id && u.role === 'ADMIN');
                const schoolStudents = students.filter(s => (s.schoolId === school.id || (!s.schoolId && school.id === 'sch1')) && !s.isDeleted);
                const schoolFees = feeRecords.filter(f => f.schoolId === school.id && schoolStudents.some(s => s.id === f.studentId));
                
                const schoolFeatures = pendingFeaturesMap[school.id] ?? school.features ?? [];

                const toggleFeature = (featureId: string) => {
                  const newFeatures = schoolFeatures.includes(featureId)
                    ? schoolFeatures.filter(f => f !== featureId)
                    : [...schoolFeatures, featureId];
                  setPendingFeaturesMap(prev => ({ ...prev, [school.id]: newFeatures }));
                };

                const handleUpdateFeatures = () => {
                  updateSchoolFeatures(school.id, schoolFeatures);
                  alert('Services updated successfully!');
                };

                return (
                  <tr key={school.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-3">
                        {school.logo ? (
                          <img src={school.logo} alt="Logo" className="w-10 h-10 object-contain border rounded bg-white p-0.5" />
                        ) : (
                          <div className="w-10 h-10 border rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No Logo</div>
                        )}
                        <div>
                          {school.name}
                          <div className="text-[10px] text-slate-500 font-normal font-mono mt-0.5">{school.id}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">Admin: {schoolAdmins.map(a => a.email).join(', ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      <div className="font-bold text-indigo-600 text-lg">{schoolStudents.length}</div>
                      <div className="text-[10px] text-emerald-600 font-bold">₹{schoolFees.reduce((acc, f) => acc + f.amount, 0).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 min-w-[300px]">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {ALL_FEATURES.map(feat => {
                          const isEnabled = schoolFeatures.includes(feat.id);
                          return (
                            <label key={feat.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${isEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-400 grayscale hover:grayscale-0'}`}>
                              <input 
                                type="checkbox" 
                                checked={isEnabled} 
                                onChange={() => toggleFeature(feat.id)}
                                className="w-2.5 h-2.5 rounded-sm accent-indigo-600"
                              />
                              {feat.label}
                            </label>
                          );
                        })}
                      </div>
                      <button onClick={handleUpdateFeatures} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded uppercase tracking-wider transition-colors">
                        Update Services
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-col gap-2 w-max ml-auto">
                        <Button onClick={() => {
                          const adminUsr = users.find(u => u.schoolId === school.id && u.role === 'ADMIN');
                          setEditingSchool(school);
                          setSchoolEditForm({
                            name: school.name,
                            address: school.address,
                            mobile: school.mobile,
                            altMobile: school.altMobile,
                            udiseCode: school.udiseCode,
                            email: school.email,
                            logo: school.logo || '',
                            adminPass: adminUsr ? adminUsr.password : ''
                          });
                        }} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 p-1.5 h-auto text-xs flex items-center justify-center gap-1 w-full">
                          <Edit className="w-3 h-3" /> Edit Info
                        </Button>
                        <Button onClick={() => {
                          if (window.confirm(`Are you sure you want to completely delete ${school.name}? This will remove all their data permanently.`)) {
                            deleteSchool(school.id);
                          }
                        }} className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 h-auto text-xs flex items-center justify-center gap-1 w-full">
                          <Trash2 className="w-3 h-3" /> Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Global Data Exchange & Backups Center (डाटा आयात-निर्यात हब) */}
      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-4 bg-indigo-600 rounded-full"></span>
            Super Admin Data & School Backup Hub (वैश्विक डेटा बैकअप केंद्र)
          </h2>
          <div className="flex items-center gap-2 text-[10px] bg-indigo-50 border border-indigo-100 px-2 py-1 rounded text-indigo-700 font-mono">
            <span>PLATFORM OPERATOR CONTROL</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          Utilize this central system to handle student registration records, class fee tiers, and configuration schemas dynamically across all active academic zones. Select a target school node first to initialize.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Controls Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">Target School Node</Label>
              <Input
                as="select"
                value={syncSchoolId}
                onChange={(e) => {
                  setSyncSchoolId(e.target.value);
                  setImportStatus('');
                  setImportedCount(0);
                }}
              >
                <option value="">-- Choose School --</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.udiseCode || 'No UDISE'})
                  </option>
                ))}
              </Input>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Data Dimension</Label>
              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSyncCategory('students');
                    setImportStatus('');
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left transition-all ${
                    syncCategory === 'students'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Full School Data Backup</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncCategory('profile');
                    setImportStatus('');
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left transition-all ${
                    syncCategory === 'profile'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>School Settings & Tiers</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncCategory('gdrive');
                    setImportStatus('');
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left transition-all ${
                    syncCategory === 'gdrive'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Local Disk (E:) & Offline Backup</span>
                </button>
              </div>
            </div>
          </div>

          {/* Working Workspace Area */}
          <div className="md:col-span-3 border border-slate-200 bg-slate-50/10 rounded-xl p-5 relative">
            {!syncSchoolId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <Building className="w-12 h-12 stroke-1 stroke-slate-300 mb-3 animate-pulse" />
                <p className="text-xs font-bold text-slate-500">No School Selected</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">
                  Please choose a target school node from the sidebar dropdown to run synchronization tasks.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Info Bar */}
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Selected: {schools.find((s) => s.id === syncSchoolId)?.name}
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      UDISE ID: {schools.find((s) => s.id === syncSchoolId)?.udiseCode || 'N/A'} • Zone ID: {syncSchoolId}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded">
                    Operational (सक्रिय)
                  </span>
                </div>

                {/* STUDENTS CATEGORY PANEL */}
                {syncCategory === 'students' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Export Card */}
                    <div className="bg-white border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
                          <Download className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">Export Complete School Backup</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Create a downloadable JSON backup package containing all student profiles, exam results (marks), attendance logs, and fee payments across all academic sessions.
                      </p>
                      <Button
                        type="button"
                        onClick={handleExportStudents}
                        className="bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 font-bold text-[10.5px] py-1.5 px-3 h-auto uppercase tracking-wide flex items-center gap-1.5 w-full justify-center transition-colors mt-2"
                      >
                        <FileJson className="w-3.5 h-3.5" />
                        Download JSON Full Backup
                      </Button>
                    </div>

                    {/* Import Card */}
                    <div className="bg-white border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-amber-50 text-amber-600 p-1.5 rounded-lg">
                          <Upload className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">Restore/Import School Data</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Upload a structured JSON backup. This process fully restores all student profiles, results, attendance logs, and fee histories under this school.
                      </p>
                      
                      <div className="space-y-2 pt-1">
                        <input
                          type="file"
                          accept=".json"
                          ref={studentInputRef}
                          onChange={handleImportStudents}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => studentInputRef.current?.click()}
                          disabled={isSyncing}
                          className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-[10.5px] py-1.5 px-3 h-auto uppercase tracking-wide flex items-center gap-1.5 w-full justify-center transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {isSyncing ? "Syncing..." : "Choose Full Backup File (.json)"}
                        </Button>
                      </div>
                    </div>

                    {/* Bulk Delete Card */}
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-rose-800">Master Data Wipe</h4>
                      </div>
                      <p className="text-[10px] text-rose-700 leading-normal font-medium">
                        DANGER: This action permanently deletes ALL student enrollment records in this school database tier. Do this only for bulk fresh testing or reset.
                      </p>
                      <Button
                        type="button"
                        onClick={async () => {
                          if(window.confirm("Are you absolutely sure you want to delete ALL students assigned to this school? This cannot be undone.")) {
                            setIsSyncing(true);
                            setImportStatus('Wiping all student documents...');
                            try {
                              await deleteAllStudentsInSchool(syncSchoolId);
                              setImportStatus('Success! Mass wipe completed. School roster is empty.');
                            } catch (e: any) {
                              setImportStatus('Error wiping students: ' + e.message);
                            } finally {
                              setIsSyncing(false);
                            }
                          }
                        }}
                        disabled={isSyncing}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] py-1.5 px-3 h-auto uppercase tracking-wide flex items-center gap-1.5 w-full justify-center transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        PURGE ALL STUDENTS
                      </Button>
                    </div>
                  </div>
                )}

                {/* PROFILE CONFIG PANEL */}
                {syncCategory === 'profile' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Export Profile */}
                    <div className="bg-white border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
                          <Download className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">Export Core System Profile</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Downloads the complete school environment blueprint, encompassing features authorization, registered academic sessions, and grade-wise fee collection matrices.
                      </p>
                      <Button
                        type="button"
                        onClick={handleExportSchoolProfile}
                        className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-[10.5px] py-1.5 px-3 h-auto uppercase tracking-wide flex items-center gap-1.5 w-full justify-center transition-colors mt-2"
                      >
                        <FileJson className="w-3.5 h-3.5" />
                        Download Profile JSON
                      </Button>
                    </div>

                    {/* Import Profile */}
                    <div className="bg-white border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-purple-50 text-purple-600 p-1.5 rounded-lg">
                          <Upload className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">Restore System Profile</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Upload a previously exported school settings package to completely overwrite and restore global feature setups, class fees configurations, and session parameters.
                      </p>
                      
                      <div className="space-y-2 pt-1">
                        <input
                          type="file"
                          accept=".json"
                          ref={profileInputRef}
                          onChange={handleImportSchoolProfile}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => profileInputRef.current?.click()}
                          disabled={isSyncing}
                          className="bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 font-bold text-[10.5px] py-1.5 px-3 h-auto uppercase tracking-wide flex items-center gap-1.5 w-full justify-center transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {isSyncing ? "Syncing..." : "Upload Profile File (.json)"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* LOCAL DISK (E:) & OFFLINE BACKUP PANEL */}
                {syncCategory === 'gdrive' && (
                  <div className="space-y-6">
                    {/* Primary Local Disk and Full Backup Action Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: Full System Disk Backup to E: Drive */}
                      <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 border-b pb-3">
                          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                            <HardDrive className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">Local Disk (E: Drive) Full Backup</h3>
                            <p className="text-[10px] text-slate-500">100% Offline • Export/Save entire database to local hard drive</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                            <div>
                              <p className="text-xs font-bold text-emerald-900">Storage Mode: Local Drive / Offline</p>
                              <p className="text-[10px] text-emerald-700">Database is active locally (Zero Cloud/Firebase)</p>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-600 text-white rounded">
                              Connected
                            </span>
                          </div>

                          <p className="text-[10.5px] text-slate-600 leading-relaxed">
                            Click below to download the entire system backup file (.json) containing all schools, student admissions, exam marks, attendance records, and fee collections. You can save this file directly into your <strong>E: Drive (e.g. E:\SchoolBackups\)</strong> or pen drive for offline safety.
                          </p>

                          <div className="pt-1 flex flex-col gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                exportFullDiskBackup();
                                setImportStatus(`Success! Downloaded complete full database backup file for saving into E: Drive.`);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-2 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Download className="w-4 h-4" />
                              Export Full System Backup to Local Disk / E:
                            </Button>

                            <input
                              type="file"
                              accept=".json"
                              ref={fullDiskInputRef}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (!window.confirm("Are you sure you want to restore the entire system from this backup file? Existing data will be merged/updated with this backup.")) return;
                                
                                setIsSyncing(true);
                                setImportStatus('Restoring full system from local disk backup file...');
                                try {
                                  const text = await file.text();
                                  const count = await importFullDiskBackup(text);
                                  setImportStatus(`Success! Successfully imported and restored ${count} total records from local disk backup file!`);
                                } catch (err: any) {
                                  setImportStatus(`Error restoring full disk backup: ${err.message}`);
                                } finally {
                                  setIsSyncing(false);
                                  if (fullDiskInputRef.current) fullDiskInputRef.current.value = '';
                                }
                              }}
                              className="hidden"
                            />

                            <Button
                              type="button"
                              onClick={() => fullDiskInputRef.current?.click()}
                              disabled={isSyncing}
                              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] py-2 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-slate-300"
                            >
                              <Upload className="w-4 h-4" />
                              Restore Full System from Local Disk (E:) File
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Instant Local Offline Restore Point */}
                      <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 border-b pb-3">
                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                              <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-800">Instant Local Offline Snapshots</h3>
                              <p className="text-[10px] text-slate-500">Fast local restore point stored directly in browser offline cache</p>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-500 leading-normal">
                            Create an instant local restore point for the selected school. This takes 1 second, works completely offline without internet, and lets you revert any mistakes instantly with <strong>1-Click</strong>.
                          </p>

                          <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-600" /> Offline Auto-Save</span>
                              <span className="text-emerald-600 font-bold">100% Active (सक्रिय)</span>
                            </div>
                            <p className="text-[9.5px] text-slate-550 leading-relaxed">
                              All operations (student edits, fee receipts, mark entries) are saved directly to local disk storage instantly.
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          disabled={isSyncing}
                          onClick={handleImmediateLocalBackup}
                          className="w-full bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 font-bold text-[11px] py-2 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                        >
                          <Database className="w-3.5 h-3.5" />
                          Create Instant Offline Snapshot
                        </Button>
                      </div>

                    </div>

                    {/* Offline Local Disk (E: Drive) Setup Guide */}
                    <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-2">
                          <div className="bg-amber-50 text-amber-600 p-2 rounded-lg">
                            <HardDrive className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">Local Disk (E: Drive) Offline Persistence Instructions</h3>
                            <p className="text-[10px] text-slate-500">Step-by-step guide to keep your school management data backed up locally</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 uppercase tracking-wider">
                          Offline Active
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-slate-50 rounded-lg p-4 space-y-2.5 text-[10.5px] border text-slate-700">
                          <p className="font-bold uppercase tracking-wider text-[10px] text-slate-850">Offline Local Disk Guidelines (लोकल डिस्क E: निर्देश):</p>
                          <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                            <li><strong>Offline Operation:</strong> Your application now operates entirely in <strong>Offline Mode</strong> without any dependency on external Firebase servers.</li>
                            <li><strong>Local Auto-Save:</strong> All school data, student admissions, exams, fees, and attendance are instantly saved in local browser storage on your computer.</li>
                            <li><strong>Saving to E: Drive:</strong> To create an archive on your hard disk, click <strong>"Export Full System Backup to Local Disk / E:"</strong>. Save the downloaded <code>.json</code> file into your <code>E:\SchoolBackups\</code> directory.</li>
                            <li><strong>Restoring from E: Drive:</strong> Whenever you change computers or want to restore a previous date, click <strong>"Restore Full System from Local Disk (E:) File"</strong> and choose your backup file.</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    {/* Local Offline Snapshots History */}
                    <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-2">
                          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                            <Database className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">Historical Offline Restore Points</h3>
                            <p className="text-[10px] text-slate-500">Manage, download, and instantly restore saved local snapshots</p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                              <th className="p-2.5">Snapshot ID</th>
                              <th className="p-2.5">School Name</th>
                              <th className="p-2.5">Saved At</th>
                              <th className="p-2.5 text-center">Students</th>
                              <th className="p-2.5 text-center">Marks</th>
                              <th className="p-2.5 text-right">Size</th>
                              <th className="p-2.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localBackups.map((b) => (
                              <tr key={b.id} className="border-b hover:bg-slate-50/60 transition-colors">
                                <td className="p-2.5 font-mono text-[10px] text-indigo-600 font-semibold">{b.id}</td>
                                <td className="p-2.5 font-medium text-slate-800">{b.schoolName}</td>
                                <td className="p-2.5 text-slate-500">{new Date(b.exportedAt).toLocaleString()}</td>
                                <td className="p-2.5 text-center font-bold text-slate-700">{b.studentsCount}</td>
                                <td className="p-2.5 text-center font-bold text-slate-700">{b.marksCount}</td>
                                <td className="p-2.5 text-right font-mono text-slate-600 font-bold">{b.size}</td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        const jsonStr = JSON.stringify({
                                          type: "school_full_backup",
                                          schoolId: b.schoolId || syncSchoolId,
                                          schoolName: b.schoolName,
                                          exportedAt: b.exportedAt,
                                          students: allStudents.filter(s => s.schoolId === (b.schoolId || syncSchoolId)),
                                          marks: allMarks.filter(m => m.schoolId === (b.schoolId || syncSchoolId)),
                                          attendances: attendances.filter(a => a.schoolId === (b.schoolId || syncSchoolId)),
                                          feeRecords: allFeeRecords.filter(f => f.schoolId === (b.schoolId || syncSchoolId))
                                        }, null, 2);
                                        const blob = new Blob([jsonStr], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `local_backup_${b.id}.json`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                      }}
                                      className="py-1 px-2 text-[9px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 uppercase"
                                    >
                                      Download
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => handleRestoreFromLocalSnapshot(b.id)}
                                      className="py-1 px-2 text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 uppercase"
                                    >
                                      Restore
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* Status Logs Display */}
                {importStatus && (
                  <div className={`p-4 rounded-lg flex items-start gap-2 text-xs border ${
                    importStatus.includes('Error') || importStatus.includes('abort') || importStatus.includes('invalid')
                      ? 'bg-rose-50 border-rose-100 text-rose-800'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  }`}>
                    {importStatus.includes('Error') || importStatus.includes('abort') || importStatus.includes('invalid') ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold uppercase tracking-wide text-[10px]">Sync Logger Output</p>
                      <p className="leading-snug">{importStatus}</p>
                      {importedCount > 0 && (
                        <p className="font-mono text-[10px] text-slate-650 font-bold">Rows updated: {importedCount}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Edit School Modal */}
      {editingSchool && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto w-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800 text-lg">Edit School Info</h3>
              <button 
                onClick={() => setEditingSchool(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <Label>School Name</Label>
                <Input 
                  value={schoolEditForm.name || ''} 
                  onChange={e => setSchoolEditForm({...schoolEditForm, name: e.target.value})} 
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input 
                  value={schoolEditForm.address || ''} 
                  onChange={e => setSchoolEditForm({...schoolEditForm, address: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primary Mobile</Label>
                  <Input 
                    value={schoolEditForm.mobile || ''} 
                    onChange={e => setSchoolEditForm({...schoolEditForm, mobile: e.target.value})} 
                  />
                </div>
                <div>
                  <Label>Alt Mobile</Label>
                  <Input 
                    value={schoolEditForm.altMobile || ''} 
                    onChange={e => setSchoolEditForm({...schoolEditForm, altMobile: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Admin E-mail</Label>
                  <Input 
                    value={schoolEditForm.email || ''} 
                    onChange={e => setSchoolEditForm({...schoolEditForm, email: e.target.value})} 
                  />
                </div>
                <div>
                  <Label>Admin Password</Label>
                  <Input 
                    type="text"
                    value={schoolEditForm.adminPass || ''} 
                    onChange={e => setSchoolEditForm({...schoolEditForm, adminPass: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>UDISE Code</Label>
                  <Input 
                    value={schoolEditForm.udiseCode || ''} 
                    onChange={e => setSchoolEditForm({...schoolEditForm, udiseCode: e.target.value})} 
                  />
                </div>
                <div>
                  <Label>School Logo <span className="text-[10px] text-slate-400 font-normal ml-1">(Square shape, Max 1MB)</span></Label>
                  <Input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, true)} className="text-xs" />
                  {schoolEditForm.logo && <img src={schoolEditForm.logo} alt="Logo" className="h-10 mt-1 object-contain border rounded" />}
                </div>
              </div>
              <Button 
                onClick={async () => {
                  try {
                    await updateSchool(editingSchool.id, schoolEditForm);
                    setEditingSchool(null);
                    alert("School updated successfully.");
                  } catch (e: any) {
                    alert("Error updating school: " + e.message);
                  }
                }} 
                className="w-full mt-4"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
