import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { Card, Button, Label, Input } from '../UI';
import { type Student, type ExamMark } from '../../types';
import { 
  Award, CheckCircle, Search, Save, Calendar, CheckSquare, Sparkles, 
  Layers, Users, User, ChevronLeft, ChevronRight, Sliders, Grid, BookOpen,
  ArrowRight, RefreshCw, Check, FlaskConical, Trash2, Eye, EyeOff,
  History, RotateCcw, AlertTriangle, Filter, HardDrive, Bookmark, CheckCircle2,
  FileText, SlidersHorizontal, AlertCircle, ArrowUpDown, X, Clock, ArrowDownUp,
  HelpCircle, Copy, CheckCheck
} from 'lucide-react';
import { 
  normalizeGrade, isSameGrade, getDefaultSubjectsForGrade, 
  isSameSubject, isPracticalSubjectForGrade, isPracticalSubject, sortSubjects
} from '../../utils/gradeHelper';
import { type StudentSortOption, type StudentMarksFilter, type StudentGenderFilter } from './ExamResults';

export interface MarksPaper12UploadingProps {
  selectedClass: string;
  setSelectedClass: (cls: string) => void;
  classes: string[];
}

interface StudentPaperRowState {
  studentId: string;
  studentName: string;
  rollNo: string;
  fatherName: string;
  gender: string;
  hasPractical: boolean; // Manual choice for practical subject

  // Half-Yearly
  hyTestObt: string;
  hyTestMax: number;
  hyP1Obt: string;
  hyP1Max: number;
  hyP2Obt: string;
  hyP2Max: number;
  hyPracObt: string;
  hyPracMax: number;

  // Annual
  yTestObt: string;
  yTestMax: number;
  yP1Obt: string;
  yP1Max: number;
  yP2Obt: string;
  yP2Max: number;
  yPracObt: string;
  yPracMax: number;
}

export const MarksPaper12Uploading: React.FC<MarksPaper12UploadingProps> = ({
  selectedClass,
  setSelectedClass,
  classes
}) => {
  const { students, marks, importMarks, currentUser } = useStore();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<StudentSortOption>('roll-asc');
  const [marksFilter, setMarksFilter] = useState<StudentMarksFilter>('all');
  const [genderFilter, setGenderFilter] = useState<StudentGenderFilter>('all');

  // Manual Out-Of (Max Marks) Fix Configuration
  const [testMaxMarks, setTestMaxMarks] = useState<number>(10);
  const [hyP1MaxMarks, setHyP1MaxMarks] = useState<number>(35);
  const [hyP2MaxMarks, setHyP2MaxMarks] = useState<number>(35);
  const [hyPracMaxMarks, setHyPracMaxMarks] = useState<number>(20);

  const [yTestMaxMarks, setYTestMaxMarks] = useState<number>(10);
  const [yP1MaxMarks, setYP1MaxMarks] = useState<number>(35);
  const [yP2MaxMarks, setYP2MaxMarks] = useState<number>(35);
  const [yPracMaxMarks, setYPracMaxMarks] = useState<number>(20);

  // Status & saving
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  // Filter students for the selected class
  const classStudents = useMemo(() => {
    return students
      .filter(s => !s.isDeleted && (s.grade === selectedClass || isSameGrade(s.grade, selectedClass)))
      .sort((a, b) => {
        const rA = Number(a.rollNo);
        const rB = Number(b.rollNo);
        if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [students, selectedClass]);

  // Dynamically compile subjects list
  const subjects = useMemo(() => {
    const set = new Set<string>();
    getDefaultSubjectsForGrade(selectedClass).forEach(sub => set.add(sub));
    classStudents.forEach(st => {
      if (st.subjects && Array.isArray(st.subjects)) {
        st.subjects.forEach(sub => set.add(sub));
      }
      if (st.optionalSubject) {
        set.add(st.optionalSubject);
      }
    });
    // Include any subjects from existing marks in this class
    const classStudentIds = new Set(classStudents.map(s => s.id));
    marks.filter(m => classStudentIds.has(m.studentId)).forEach(m => {
      if (m.subject) {
        set.add(m.subject);
      }
    });

    const unique = Array.from(set);
    return unique.length > 0 
      ? sortSubjects(unique) 
      : ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Drawing', 'Home Science', 'Computer', 'Sanskrit'];
  }, [selectedClass, classStudents, marks]);

  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || 'Hindi');

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(selectedSubject)) {
      setSelectedSubject(subjects[0]);
    }
  }, [subjects, selectedSubject]);

  // Check if subject is known practical by default
  const isDefaultPractical = useMemo(() => {
    return isPracticalSubjectForGrade(selectedSubject, selectedClass) || isPracticalSubject(selectedSubject);
  }, [selectedSubject, selectedClass]);

  // Main student marks ledger rows state
  const [rowMarks, setRowMarks] = useState<Record<string, StudentPaperRowState>>({});

  // Populate rowMarks from existing store marks and draft
  useEffect(() => {
    const newRows: Record<string, StudentPaperRowState> = {};
    const draftKey = `yug_paper12_draft_${selectedClass}_${selectedSubject}`;
    let draftData: Record<string, any> | null = null;
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        draftData = JSON.parse(savedDraft);
      }
    } catch {
      draftData = null;
    }

    classStudents.forEach(st => {
      const stMarks = marks.filter(m => m.studentId === st.id && isSameSubject(m.subject, selectedSubject));
      const hyTest = stMarks.find(m => m.examType === 'Half-Yearly Test');
      const hyExam = stMarks.find(m => m.examType === 'Half-Yearly Exam');
      const hyPrac = stMarks.find(m => m.examType === 'Half-Yearly Practical' || m.examType === 'Practical Exam');

      const yTest = stMarks.find(m => m.examType === 'Yearly Test');
      const yExam = stMarks.find(m => m.examType === 'Yearly Exam');
      const yPrac = stMarks.find(m => m.examType === 'Yearly Practical' || m.examType === 'Practical Exam');

      // Check if practical is present
      const hasPracticalData = (hyExam && (hyExam.practicalMarks !== undefined || (hyExam.practicalMaxMarks && hyExam.practicalMaxMarks > 0))) ||
        (yExam && (yExam.practicalMarks !== undefined || (yExam.practicalMaxMarks && yExam.practicalMaxMarks > 0))) ||
        !!hyPrac || !!yPrac || isDefaultPractical;

      // Draft fallback if available
      const draftRow = draftData ? draftData[st.id] : null;

      const hyTestVal = draftRow?.hyTestObt !== undefined ? draftRow.hyTestObt : (hyTest ? String(hyTest.marksObtained) : '');
      const hyP1Val = draftRow?.hyP1Obt !== undefined ? draftRow.hyP1Obt : (hyExam ? String(hyExam.marksObtained) : '');
      const hyP2Val = draftRow?.hyP2Obt !== undefined ? draftRow.hyP2Obt : (hyExam && (hyExam as any).paper2Marks !== undefined ? String((hyExam as any).paper2Marks) : '');
      const hyPracVal = draftRow?.hyPracObt !== undefined ? draftRow.hyPracObt : (
        hyExam && hyExam.practicalMarks !== undefined ? String(hyExam.practicalMarks) : (hyPrac ? String(hyPrac.marksObtained) : '')
      );

      const yTestVal = draftRow?.yTestObt !== undefined ? draftRow.yTestObt : (yTest ? String(yTest.marksObtained) : '');
      const yP1Val = draftRow?.yP1Obt !== undefined ? draftRow.yP1Obt : (yExam ? String(yExam.marksObtained) : '');
      const yP2Val = draftRow?.yP2Obt !== undefined ? draftRow.yP2Obt : (yExam && (yExam as any).paper2Marks !== undefined ? String((yExam as any).paper2Marks) : '');
      const yPracVal = draftRow?.yPracObt !== undefined ? draftRow.yPracObt : (
        yExam && yExam.practicalMarks !== undefined ? String(yExam.practicalMarks) : (yPrac ? String(yPrac.marksObtained) : '')
      );

      const hasPracChoice = draftRow?.hasPractical !== undefined ? draftRow.hasPractical : hasPracticalData;

      newRows[st.id] = {
        studentId: st.id,
        studentName: st.name,
        rollNo: st.rollNo || '-',
        fatherName: st.fatherName || '-',
        gender: st.gender || 'Male',
        hasPractical: hasPracChoice,

        hyTestObt: hyTestVal,
        hyTestMax: draftRow?.hyTestMax || hyTest?.maxMarks || testMaxMarks,
        hyP1Obt: hyP1Val,
        hyP1Max: draftRow?.hyP1Max || hyExam?.maxMarks || hyP1MaxMarks,
        hyP2Obt: hyP2Val,
        hyP2Max: draftRow?.hyP2Max || (hyExam as any)?.paper2MaxMarks || hyP2MaxMarks,
        hyPracObt: hyPracVal,
        hyPracMax: draftRow?.hyPracMax || hyExam?.practicalMaxMarks || hyPracMaxMarks,

        yTestObt: yTestVal,
        yTestMax: draftRow?.yTestMax || yTest?.maxMarks || yTestMaxMarks,
        yP1Obt: yP1Val,
        yP1Max: draftRow?.yP1Max || yExam?.maxMarks || yP1MaxMarks,
        yP2Obt: yP2Val,
        yP2Max: draftRow?.yP2Max || (yExam as any)?.paper2MaxMarks || yP2MaxMarks,
        yPracObt: yPracVal,
        yPracMax: draftRow?.yPracMax || yExam?.practicalMaxMarks || yPracMaxMarks,
      };
    });

    setRowMarks(newRows);
    if (draftData) {
      setDraftNotice('लोकल ड्राफ्ट से डेटा पुनर्प्राप्त किया गया (Recovered unsaved draft from browser storage)');
      setTimeout(() => setDraftNotice(null), 5000);
    }
  }, [selectedClass, selectedSubject, classStudents, marks, isDefaultPractical]);

  // Periodic Auto-Save draft to localStorage
  useEffect(() => {
    if (Object.keys(rowMarks).length === 0) return;
    const timer = setTimeout(() => {
      try {
        const draftKey = `yug_paper12_draft_${selectedClass}_${selectedSubject}`;
        localStorage.setItem(draftKey, JSON.stringify(rowMarks));
      } catch (err) {
        console.error('Draft auto-save failed:', err);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [rowMarks, selectedClass, selectedSubject]);

  // Preset schemes application
  const applyPresetScheme = (scheme: '100-prac' | '100-nonprac' | '100-theory-only' | '50-50') => {
    if (scheme === '100-prac') {
      setTestMaxMarks(10);
      setHyP1MaxMarks(35);
      setHyP2MaxMarks(35);
      setHyPracMaxMarks(20);
      setYTestMaxMarks(10);
      setYP1MaxMarks(35);
      setYP2MaxMarks(35);
      setYPracMaxMarks(20);
    } else if (scheme === '100-nonprac') {
      setTestMaxMarks(10);
      setHyP1MaxMarks(45);
      setHyP2MaxMarks(45);
      setHyPracMaxMarks(0);
      setYTestMaxMarks(10);
      setYP1MaxMarks(45);
      setYP2MaxMarks(45);
      setYPracMaxMarks(0);
    } else if (scheme === '100-theory-only') {
      setTestMaxMarks(10);
      setHyP1MaxMarks(90);
      setHyP2MaxMarks(0);
      setHyPracMaxMarks(0);
      setYTestMaxMarks(10);
      setYP1MaxMarks(90);
      setYP2MaxMarks(0);
      setYPracMaxMarks(0);
    } else if (scheme === '50-50') {
      setTestMaxMarks(10);
      setHyP1MaxMarks(50);
      setHyP2MaxMarks(50);
      setHyPracMaxMarks(0);
      setYTestMaxMarks(10);
      setYP1MaxMarks(50);
      setYP2MaxMarks(50);
      setYPracMaxMarks(0);
    }
  };

  // Bulk apply max marks to all students in current view
  const handleApplyMaxMarksToAll = () => {
    setRowMarks(prev => {
      const updated: Record<string, StudentPaperRowState> = { ...prev };
      Object.keys(updated).forEach(stId => {
        updated[stId] = {
          ...updated[stId],
          hyTestMax: testMaxMarks,
          hyP1Max: hyP1MaxMarks,
          hyP2Max: hyP2MaxMarks,
          hyPracMax: hyPracMaxMarks,
          yTestMax: yTestMaxMarks,
          yP1Max: yP1MaxMarks,
          yP2Max: yP2MaxMarks,
          yPracMax: yPracMaxMarks,
        };
      });
      return updated;
    });
  };

  // Field change handler
  const handleCellChange = (
    studentId: string, 
    field: keyof StudentPaperRowState, 
    value: any
  ) => {
    setRowMarks(prev => {
      const currentRow = prev[studentId] || {
        studentId,
        studentName: '',
        rollNo: '-',
        fatherName: '-',
        gender: 'Male',
        hasPractical: false,
        hyTestObt: '',
        hyTestMax: testMaxMarks,
        hyP1Obt: '',
        hyP1Max: hyP1MaxMarks,
        hyP2Obt: '',
        hyP2Max: hyP2MaxMarks,
        hyPracObt: '',
        hyPracMax: hyPracMaxMarks,
        yTestObt: '',
        yTestMax: yTestMaxMarks,
        yP1Obt: '',
        yP1Max: yP1MaxMarks,
        yP2Obt: '',
        yP2Max: yP2MaxMarks,
        yPracObt: '',
        yPracMax: yPracMaxMarks,
      };

      return {
        ...prev,
        [studentId]: {
          ...currentRow,
          [field]: value
        }
      };
    });
  };

  // Toggle practical for a single student
  const handleTogglePractical = (studentId: string) => {
    setRowMarks(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      const nextState = !current.hasPractical;
      return {
        ...prev,
        [studentId]: {
          ...current,
          hasPractical: nextState,
          // Clear practical marks if toggled off
          hyPracObt: nextState ? current.hyPracObt : '',
          yPracObt: nextState ? current.yPracObt : ''
        }
      };
    });
  };

  // Bulk Practical toggle actions
  const handleBulkTogglePractical = (enable: boolean) => {
    setRowMarks(prev => {
      const updated: Record<string, StudentPaperRowState> = { ...prev };
      Object.keys(updated).forEach(stId => {
        updated[stId] = {
          ...updated[stId],
          hasPractical: enable,
          hyPracObt: enable ? updated[stId].hyPracObt : '',
          yPracObt: enable ? updated[stId].yPracObt : ''
        };
      });
      return updated;
    });
  };

  // Fill Fixed Test Marks for all (e.g. 10)
  const handleBulkFillTestMarks = (val: string) => {
    setRowMarks(prev => {
      const updated: Record<string, StudentPaperRowState> = { ...prev };
      Object.keys(updated).forEach(stId => {
        updated[stId] = {
          ...updated[stId],
          hyTestObt: val,
          yTestObt: val
        };
      });
      return updated;
    });
  };

  // Quick Copy HY Marks to Annual
  const handleCopyHyToAnnual = () => {
    setRowMarks(prev => {
      const updated: Record<string, StudentPaperRowState> = { ...prev };
      Object.keys(updated).forEach(stId => {
        const r = updated[stId];
        updated[stId] = {
          ...r,
          yTestObt: r.hyTestObt,
          yP1Obt: r.hyP1Obt,
          yP2Obt: r.hyP2Obt,
          yPracObt: r.hasPractical ? r.hyPracObt : ''
        };
      });
      return updated;
    });
  };

  // Calculation helpers per student row
  const calculateRowTotals = (row: StudentPaperRowState) => {
    const parseNum = (v: string) => {
      if (v === '' || v === undefined || v === null) return 0;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    const hasHyTest = row.hyTestObt.trim() !== '';
    const hasHyP1 = row.hyP1Obt.trim() !== '';
    const hasHyP2 = row.hyP2Obt.trim() !== '';
    const hasHyPrac = row.hasPractical && row.hyPracObt.trim() !== '';

    const hyTestObt = parseNum(row.hyTestObt);
    const hyP1Obt = parseNum(row.hyP1Obt);
    const hyP2Obt = parseNum(row.hyP2Obt);
    const hyPracObt = row.hasPractical ? parseNum(row.hyPracObt) : 0;

    const hyTotalObt = hyTestObt + hyP1Obt + hyP2Obt + hyPracObt;
    const hyTotalMax = (hasHyTest ? row.hyTestMax : (row.hyTestMax || 10)) + 
      (hasHyP1 ? row.hyP1Max : (row.hyP1Max || 35)) + 
      (row.hyP2Max > 0 ? row.hyP2Max : 0) + 
      (row.hasPractical ? (row.hyPracMax || 20) : 0);

    const hasYTest = row.yTestObt.trim() !== '';
    const hasYP1 = row.yP1Obt.trim() !== '';
    const hasYP2 = row.yP2Obt.trim() !== '';
    const hasYPrac = row.hasPractical && row.yPracObt.trim() !== '';

    const yTestObt = parseNum(row.yTestObt);
    const yP1Obt = parseNum(row.yP1Obt);
    const yP2Obt = parseNum(row.yP2Obt);
    const yPracObt = row.hasPractical ? parseNum(row.yPracObt) : 0;

    const yTotalObt = yTestObt + yP1Obt + yP2Obt + yPracObt;
    const yTotalMax = (hasYTest ? row.yTestMax : (row.yTestMax || 10)) + 
      (hasYP1 ? row.yP1Max : (row.yP1Max || 35)) + 
      (row.yP2Max > 0 ? row.yP2Max : 0) + 
      (row.hasPractical ? (row.yPracMax || 20) : 0);

    const grandObt = hyTotalObt + yTotalObt;
    const grandMax = hyTotalMax + yTotalMax;
    const percentage = grandMax > 0 ? (grandObt / grandMax) * 100 : 0;

    let grade = 'E';
    if (percentage >= 91) grade = 'A1';
    else if (percentage >= 81) grade = 'A2';
    else if (percentage >= 71) grade = 'B1';
    else if (percentage >= 61) grade = 'B2';
    else if (percentage >= 51) grade = 'C1';
    else if (percentage >= 41) grade = 'C2';
    else if (percentage >= 33) grade = 'D';

    const isFilled = (hasHyTest || hasHyP1 || hasHyP2 || hasHyPrac) && (hasYTest || hasYP1 || hasYP2 || hasYPrac);

    return {
      hyTotalObt,
      hyTotalMax,
      yTotalObt,
      yTotalMax,
      grandObt,
      grandMax,
      percentage,
      grade,
      isFilled
    };
  };

  // Filter & Sort students
  const filteredStudents = useMemo(() => {
    let list = [...classStudents];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(st => 
        (st.name || '').toLowerCase().includes(q) ||
        (st.rollNo || '').toLowerCase().includes(q) ||
        (st.fatherName || '').toLowerCase().includes(q) ||
        (st.srNo || '').toLowerCase().includes(q)
      );
    }

    // Gender filter
    if (genderFilter !== 'all') {
      list = list.filter(st => (st.gender || 'Male').toLowerCase() === genderFilter.toLowerCase());
    }

    // Marks Status filter
    if (marksFilter !== 'all') {
      list = list.filter(st => {
        const row = rowMarks[st.id];
        if (!row) return marksFilter === 'pending';
        const { isFilled } = calculateRowTotals(row);
        return marksFilter === 'completed' ? isFilled : !isFilled;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'roll-asc') {
        const rA = Number(a.rollNo);
        const rB = Number(b.rollNo);
        if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'roll-desc') {
        const rA = Number(a.rollNo);
        const rB = Number(b.rollNo);
        if (!isNaN(rA) && !isNaN(rB)) return rB - rA;
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'father-asc') return (a.fatherName || '').localeCompare(b.fatherName || '');
      if (sortBy === 'sr-asc') return (a.srNo || '').localeCompare(b.srNo || '');
      if (sortBy === 'gender-boys') return (a.gender === 'Female' ? 1 : 0) - (b.gender === 'Female' ? 1 : 0);
      if (sortBy === 'gender-girls') return (a.gender === 'Male' ? 1 : 0) - (b.gender === 'Male' ? 1 : 0);
      return 0;
    });

    return list;
  }, [classStudents, searchQuery, genderFilter, marksFilter, sortBy, rowMarks]);

  // Overall Statistics
  const stats = useMemo(() => {
    let completedCount = 0;
    let practicalStudentCount = 0;
    classStudents.forEach(st => {
      const row = rowMarks[st.id];
      if (row) {
        const { isFilled } = calculateRowTotals(row);
        if (isFilled) completedCount++;
        if (row.hasPractical) practicalStudentCount++;
      }
    });

    return {
      total: classStudents.length,
      completed: completedCount,
      pending: classStudents.length - completedCount,
      practicalCount: practicalStudentCount
    };
  }, [classStudents, rowMarks]);

  // Save all marks to Firestore & Store
  const handleSaveMarksToDatabase = async () => {
    if (classStudents.length === 0) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      const marksToSave: Omit<ExamMark, 'id'>[] = [];
      const nowIso = new Date().toISOString();

      const schoolId = currentUser?.schoolId || 'school-default';
      const teacherId = currentUser?.id || 'admin';

      (Object.values(rowMarks) as StudentPaperRowState[]).forEach(row => {
        const parseNumOrUndef = (v: string) => {
          if (v === '' || v === undefined || v === null) return undefined;
          const n = Number(v);
          return isNaN(n) ? undefined : n;
        };

        const hyTest = parseNumOrUndef(row.hyTestObt);
        const hyP1 = parseNumOrUndef(row.hyP1Obt);
        const hyP2 = parseNumOrUndef(row.hyP2Obt);
        const hyPrac = row.hasPractical ? parseNumOrUndef(row.hyPracObt) : undefined;

        const yTest = parseNumOrUndef(row.yTestObt);
        const yP1 = parseNumOrUndef(row.yP1Obt);
        const yP2 = parseNumOrUndef(row.yP2Obt);
        const yPrac = row.hasPractical ? parseNumOrUndef(row.yPracObt) : undefined;

        // 1. Half-Yearly Test
        if (hyTest !== undefined) {
          marksToSave.push({
            schoolId,
            studentId: row.studentId,
            teacherId,
            subject: selectedSubject,
            examType: 'Half-Yearly Test',
            marksObtained: hyTest,
            maxMarks: row.hyTestMax || testMaxMarks,
            date: nowIso
          });
        }

        // 2. Half-Yearly Exam (P-I, P-II, Practical)
        if (hyP1 !== undefined || hyP2 !== undefined || hyPrac !== undefined) {
          marksToSave.push({
            schoolId,
            studentId: row.studentId,
            teacherId,
            subject: selectedSubject,
            examType: 'Half-Yearly Exam',
            marksObtained: hyP1 !== undefined ? hyP1 : 0,
            maxMarks: row.hyP1Max || hyP1MaxMarks,
            paper2Marks: hyP2,
            paper2MaxMarks: row.hyP2Max || hyP2MaxMarks,
            practicalMarks: hyPrac,
            practicalMaxMarks: row.hasPractical ? (row.hyPracMax || hyPracMaxMarks) : 0,
            date: nowIso
          });
        }

        // 3. Yearly Test
        if (yTest !== undefined) {
          marksToSave.push({
            schoolId,
            studentId: row.studentId,
            teacherId,
            subject: selectedSubject,
            examType: 'Yearly Test',
            marksObtained: yTest,
            maxMarks: row.yTestMax || yTestMaxMarks,
            date: nowIso
          });
        }

        // 4. Yearly Exam (P-I, P-II, Practical)
        if (yP1 !== undefined || yP2 !== undefined || yPrac !== undefined) {
          marksToSave.push({
            schoolId,
            studentId: row.studentId,
            teacherId,
            subject: selectedSubject,
            examType: 'Yearly Exam',
            marksObtained: yP1 !== undefined ? yP1 : 0,
            maxMarks: row.yP1Max || yP1MaxMarks,
            paper2Marks: yP2,
            paper2MaxMarks: row.yP2Max || yP2MaxMarks,
            practicalMarks: yPrac,
            practicalMaxMarks: row.hasPractical ? (row.yPracMax || yPracMaxMarks) : 0,
            date: nowIso
          });
        }
      });

      if (marksToSave.length > 0) {
        await importMarks(marksToSave);
      }

      // Clear draft since it is saved
      const draftKey = `yug_paper12_draft_${selectedClass}_${selectedSubject}`;
      localStorage.removeItem(draftKey);

      setSaveSuccessMsg(`सफलतापूर्वक ${marksToSave.length} परीक्षा रिकॉर्ड सुरक्षित कर दिए गए हैं! (Saved ${marksToSave.length} marks records successfully)`);
      setTimeout(() => setSaveSuccessMsg(null), 6000);
    } catch (err) {
      console.error('Error saving marks:', err);
      alert('अंक सुरक्षित करने में त्रुटि हुई। कृपया पुनः प्रयास करें।');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* SECTION BANNER & CONTROLS                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-indigo-700/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30 shadow-inner">
              <Award className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide text-white font-serif">
                  Marks Paper 1-2 Uploading Here
                </h2>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Paper I + Paper II + Test + Practical
                </span>
                <span className="bg-emerald-500/30 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40">
                  Half-Yearly &amp; Annual Master Ledger
                </span>
              </div>
              <p className="text-xs text-blue-200/90 mt-0.5">
                यहाँ टेस्ट, पेपर 1, पेपर 2 (अर्धवार्षिक व वार्षिक) और केवल चुने गए प्रैक्टिकल छात्रों के अंक दर्ज करें:
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveMarksToDatabase}
              disabled={isSaving || classStudents.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                isSaving 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-300'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>सुरक्षित हो रहा है (Saving)...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>डेटाबेस में सेव करें (Save All Marks)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success / Draft Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-100 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {draftNotice && (
          <div className="bg-amber-500/20 border border-amber-400 text-amber-200 p-2 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{draftNotice}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MANUAL MAX MARKS (TEST OUT OF FIX & PAPER SCHEME TOOLBAR)      */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-indigo-500/40 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                1. टेस्ट व पेपर्स के अधिकतम अंक फिक्स करें (Manual Max Marks Setup)
              </span>
            </div>

            {/* Quick Scheme Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400">स्कीम प्रीसेट (Presets):</span>
              <button
                type="button"
                onClick={() => applyPresetScheme('100-prac')}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-indigo-800 hover:bg-indigo-700 text-indigo-100 border border-indigo-600 transition-colors"
                title="Test: 10 + P1: 35 + P2: 35 + Prac: 20 = 100"
              >
                100 अंक (Test:10 + P1:35 + P2:35 + Prac:20)
              </button>
              <button
                type="button"
                onClick={() => applyPresetScheme('100-nonprac')}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-purple-800 hover:bg-purple-700 text-purple-100 border border-purple-600 transition-colors"
                title="Test: 10 + P1: 45 + P2: 45 = 100"
              >
                100 अंक (Test:10 + P1:45 + P2:45)
              </button>
              <button
                type="button"
                onClick={() => applyPresetScheme('50-50')}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-blue-800 hover:bg-blue-700 text-blue-100 border border-blue-600 transition-colors"
                title="Test: 10 + P1: 50 + P2: 50"
              >
                50-50 थ्योरी (P1:50 + P2:50)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 items-center text-xs">
            {/* HY Test */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-amber-300 flex items-center gap-1">
                <span>HY Test (Test Out Of):</span>
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={testMaxMarks}
                onChange={e => setTestMaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-amber-400 mt-1"
              />
            </div>

            {/* HY P1 */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-indigo-300">
                HY Paper 1 Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={hyP1MaxMarks}
                onChange={e => setHyP1MaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-indigo-400 mt-1"
              />
            </div>

            {/* HY P2 */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-purple-300">
                HY Paper 2 Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={hyP2MaxMarks}
                onChange={e => setHyP2MaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-purple-400 mt-1"
              />
            </div>

            {/* HY Prac */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-emerald-300">
                HY Prac Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={hyPracMaxMarks}
                onChange={e => setHyPracMaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-emerald-400 mt-1"
              />
            </div>

            {/* Annual Test */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-amber-300">
                Annual Test Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={yTestMaxMarks}
                onChange={e => setYTestMaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-amber-400 mt-1"
              />
            </div>

            {/* Annual P1 */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-indigo-300">
                Annual P-1 Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={yP1MaxMarks}
                onChange={e => setYP1MaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-indigo-400 mt-1"
              />
            </div>

            {/* Annual P2 */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-purple-300">
                Annual P-2 Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={yP2MaxMarks}
                onChange={e => setYP2MaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-purple-400 mt-1"
              />
            </div>

            {/* Annual Prac */}
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Label className="text-[10px] font-extrabold text-emerald-300">
                Annual Prac Max:
              </Label>
              <input
                type="number"
                min="0"
                max="200"
                value={yPracMaxMarks}
                onChange={e => setYPracMaxMarks(Number(e.target.value))}
                className="w-full text-center font-mono font-bold text-slate-950 bg-white rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-emerald-400 mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
              <span>💡 कुल योग (HY + Annual Total):</span>
              <span className="font-bold text-amber-300">
                HY: {testMaxMarks + hyP1MaxMarks + hyP2MaxMarks + hyPracMaxMarks} | Annual: {yTestMaxMarks + yP1MaxMarks + yP2MaxMarks + yPracMaxMarks}
              </span>
            </div>

            <button
              type="button"
              onClick={handleApplyMaxMarksToAll}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-300" />
              <span>सभी छात्रों पर यह अधिकतम अंक लागू करें (Apply Max Marks)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SELECTION BAR (CLASS, SUBJECT & BULK CONTROLS)                 */}
      {/* ------------------------------------------------------------- */}
      <Card className="p-3.5 bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 items-end">
          {/* Class Picker */}
          <div className="lg:col-span-3">
            <Label className="font-bold text-slate-700 text-xs flex items-center gap-1 mb-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>कक्षा चुनें (Select Class):</span>
            </Label>
            <Input
              as="select"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border-slate-300"
            >
              {classes.map(cl => <option key={cl} value={cl}>{cl}</option>)}
            </Input>
          </div>

          {/* Subject Picker */}
          <div className="lg:col-span-4">
            <Label className="font-bold text-slate-700 text-xs flex items-center gap-1 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>विषय चुनें (Select Subject):</span>
            </Label>
            <Input
              as="select"
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="text-xs font-bold text-indigo-900 bg-indigo-50/50 border-indigo-300"
            >
              {subjects.map(sb => (
                <option key={sb} value={sb}>
                  {sb} {isPracticalSubjectForGrade(sb, selectedClass) ? '🧪 (Practical Subject)' : ''}
                </option>
              ))}
            </Input>
          </div>

          {/* Search Student */}
          <div className="lg:col-span-5">
            <Label className="font-bold text-slate-700 text-xs flex items-center gap-1 mb-1">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>छात्र खोजें (Search Student):</span>
            </Label>
            <div className="relative">
              <input
                type="text"
                placeholder="रोल नं, नाम, पिता का नाम..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-8 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Practical Choice & Bulk Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Practical Choice Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
              <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
              <span>प्रैक्टिकल विषय चयन (Practical Choice):</span>
            </span>
            <button
              type="button"
              onClick={() => handleBulkTogglePractical(true)}
              className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
              title="सभी छात्रों के लिए प्रैक्टिकल कॉलम खोलें"
            >
              <CheckSquare className="w-3 h-3 text-emerald-600" />
              <span>सभी के लिए प्रैक्टिकल चालू (All Practical)</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkTogglePractical(false)}
              className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 transition-all cursor-pointer flex items-center gap-1"
              title="प्रैक्टिकल कॉलम बंद करें (केवल थ्योरी/पेपर 1-2)"
            >
              <X className="w-3 h-3 text-slate-500" />
              <span>प्रैक्टिकल बंद (No Practical)</span>
            </button>
            <span className="text-[10px] text-slate-500 italic">
              ({stats.practicalCount} / {classStudents.length} छात्र प्रैक्टिकल में चयनित)
            </span>
          </div>

          {/* Quick Data Fill Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkFillTestMarks(String(testMaxMarks))}
              className="text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition-all cursor-pointer flex items-center gap-1"
              title={`सभी छात्रों के टेस्ट में ${testMaxMarks} भरें`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>1-क्लिक टेस्ट अंक भरें ({testMaxMarks})</span>
            </button>
            <button
              type="button"
              onClick={handleCopyHyToAnnual}
              className="text-[11px] font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer flex items-center gap-1"
              title="अर्धवार्षिक के अंक वार्षिक में कॉपी करें"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              <span>HY ➔ Annual कॉपी</span>
            </button>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* MASTER DATA ENTRY TABLE                                       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Top Header Stats */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 uppercase">
              विषय परिणाम लेजर ({selectedSubject}) - {selectedClass}
            </span>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200">
              {filteredStudents.length} छात्र प्रदर्शित
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>पूर्ण: <strong className="text-slate-900">{stats.completed}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>बाकी: <strong className="text-slate-900">{stats.pending}</strong></span>
            </div>
          </div>
        </div>

        {/* Scrollable Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse min-w-[1050px]">
            <thead>
              {/* Row 1: High Level Groupings */}
              <tr className="bg-slate-800 text-white font-extrabold border-b border-slate-700">
                <th rowSpan={2} className="p-2 border-r border-slate-700 w-12 text-center">
                  रोल नं
                </th>
                <th rowSpan={2} className="p-2 border-r border-slate-700 text-left min-w-[160px]">
                  छात्र का नाम / पिता का नाम
                </th>
                <th rowSpan={2} className="p-2 border-r border-slate-700 w-24 text-center bg-emerald-950/70 text-emerald-300">
                  <div className="flex flex-col items-center">
                    <FlaskConical className="w-3.5 h-3.5 mb-0.5" />
                    <span>प्रैक्टिकल?</span>
                  </div>
                </th>
                
                {/* Half Yearly Group */}
                <th colSpan={5} className="p-2 border-r border-slate-700 bg-indigo-950 text-indigo-200 text-center font-black tracking-wider">
                  HALF YEARLY (अर्धवार्षिक परीक्षा)
                </th>

                {/* Annual Group */}
                <th colSpan={5} className="p-2 border-r border-slate-700 bg-purple-950 text-purple-200 text-center font-black tracking-wider">
                  ANNUAL (वार्षिक परीक्षा)
                </th>

                {/* Final Summary Group */}
                <th colSpan={3} className="p-2 bg-slate-900 text-amber-300 text-center font-black tracking-wider">
                  FINAL (महायोग)
                </th>
              </tr>

              {/* Row 2: Sub Headers */}
              <tr className="bg-slate-100 text-slate-800 font-black text-[11px] border-b-2 border-slate-300">
                {/* HY Columns */}
                <th className="p-1.5 border-r border-slate-300 bg-amber-50/80 text-amber-900 w-16" title={`Test Out of ${testMaxMarks}`}>
                  <div>TEST</div>
                  <div className="text-[9px] text-amber-700 font-normal">/{testMaxMarks}</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-indigo-50/80 text-indigo-900 w-16" title={`Paper 1 Out of ${hyP1MaxMarks}`}>
                  <div>PAPER 1</div>
                  <div className="text-[9px] text-indigo-700 font-normal">/{hyP1MaxMarks}</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-purple-50/80 text-purple-900 w-16" title={`Paper 2 Out of ${hyP2MaxMarks}`}>
                  <div>PAPER 2</div>
                  <div className="text-[9px] text-purple-700 font-normal">/{hyP2MaxMarks}</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-emerald-50/80 text-emerald-950 w-16" title="Practical Marks (if selected)">
                  <div>PRAC.</div>
                  <div className="text-[9px] text-emerald-700 font-normal">/{hyPracMaxMarks}</div>
                </th>
                <th className="p-1.5 border-r-2 border-slate-400 bg-indigo-100/90 text-indigo-950 w-16">
                  <div>HY OBT.</div>
                  <div className="text-[9px] text-slate-500 font-normal">Total</div>
                </th>

                {/* Annual Columns */}
                <th className="p-1.5 border-r border-slate-300 bg-amber-50/80 text-amber-900 w-16" title={`Test Out of ${yTestMaxMarks}`}>
                  <div>TEST</div>
                  <div className="text-[9px] text-amber-700 font-normal">/{yTestMaxMarks}</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-indigo-50/80 text-indigo-900 w-16" title={`Paper 1 Out of ${yP1MaxMarks}`}>
                  <div>PAPER 1</div>
                  <div className="text-[9px] text-indigo-700 font-normal">/{yP1MaxMarks}</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-purple-50/80 text-purple-900 w-16" title={`Paper 2 Out of ${yP2MaxMarks}`}>
                  <div>PAPER 2</div>
                  <div className="text-[9px] text-purple-700 font-normal">/{yP2MaxMarks}</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-emerald-50/80 text-emerald-950 w-16" title="Practical Marks (if selected)">
                  <div>PRAC.</div>
                  <div className="text-[9px] text-emerald-700 font-normal">/{yPracMaxMarks}</div>
                </th>
                <th className="p-1.5 border-r-2 border-slate-400 bg-purple-100/90 text-purple-950 w-16">
                  <div>ANN OBT.</div>
                  <div className="text-[9px] text-slate-500 font-normal">Total</div>
                </th>

                {/* Final Columns */}
                <th className="p-1.5 border-r border-slate-300 bg-slate-200 text-slate-800 w-16">
                  <div>GRAND</div>
                  <div className="text-[9px] text-slate-500 font-normal">Obt / Max</div>
                </th>
                <th className="p-1.5 border-r border-slate-300 bg-blue-100 text-blue-900 w-14">
                  <div>%</div>
                </th>
                <th className="p-1.5 bg-emerald-100 text-emerald-900 w-14">
                  <div>GRADE</div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400 italic">
                    कोई छात्र नहीं मिला (No students found matching current filters)
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => {
                  const row = rowMarks[st.id] || {
                    studentId: st.id,
                    studentName: st.name,
                    rollNo: st.rollNo || '-',
                    fatherName: st.fatherName || '-',
                    gender: st.gender || 'Male',
                    hasPractical: false,
                    hyTestObt: '',
                    hyTestMax: testMaxMarks,
                    hyP1Obt: '',
                    hyP1Max: hyP1MaxMarks,
                    hyP2Obt: '',
                    hyP2Max: hyP2MaxMarks,
                    hyPracObt: '',
                    hyPracMax: hyPracMaxMarks,
                    yTestObt: '',
                    yTestMax: yTestMaxMarks,
                    yP1Obt: '',
                    yP1Max: yP1MaxMarks,
                    yP2Obt: '',
                    yP2Max: yP2MaxMarks,
                    yPracObt: '',
                    yPracMax: yPracMaxMarks,
                  };

                  const { hyTotalObt, yTotalObt, grandObt, grandMax, percentage, grade, isFilled } = calculateRowTotals(row);

                  return (
                    <tr 
                      key={st.id} 
                      className={`hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* 1. Roll No */}
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-800 text-center">
                        {st.rollNo || idx + 1}
                      </td>

                      {/* 2. Student Name & Father Name */}
                      <td className="p-2 border-r border-slate-200 text-left">
                        <div className="font-extrabold text-slate-900 uppercase text-xs">
                          {st.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          पिता: {st.fatherName || '-'}
                        </div>
                      </td>

                      {/* 3. Practical Choice Toggle */}
                      <td className="p-1.5 border-r border-slate-200 text-center bg-emerald-50/30">
                        <button
                          type="button"
                          onClick={() => handleTogglePractical(st.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer border flex items-center justify-center gap-1 mx-auto ${
                            row.hasPractical
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs ring-1 ring-emerald-300'
                              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                          }`}
                          title="इस छात्र के लिए प्रैक्टिकल चालू/बंद करें"
                        >
                          <FlaskConical className="w-3 h-3" />
                          <span>{row.hasPractical ? 'हाँ (Yes)' : 'नहीं (No)'}</span>
                        </button>
                      </td>

                      {/* ------------------------------------------- */}
                      {/* HALF YEARLY INPUTS                          */}
                      {/* ------------------------------------------- */}
                      {/* HY Test */}
                      <td className="p-1 border-r border-slate-200 bg-amber-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="-"
                          value={row.hyTestObt}
                          onChange={e => handleCellChange(st.id, 'hyTestObt', e.target.value)}
                          className="w-full text-center font-mono font-bold text-slate-900 bg-white border border-amber-300 rounded py-1 px-1 focus:bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                        />
                      </td>

                      {/* HY Paper 1 */}
                      <td className="p-1 border-r border-slate-200 bg-indigo-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="-"
                          value={row.hyP1Obt}
                          onChange={e => handleCellChange(st.id, 'hyP1Obt', e.target.value)}
                          className="w-full text-center font-mono font-bold text-indigo-950 bg-white border border-indigo-300 rounded py-1 px-1 focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                        />
                      </td>

                      {/* HY Paper 2 */}
                      <td className="p-1 border-r border-slate-200 bg-purple-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="-"
                          value={row.hyP2Obt}
                          onChange={e => handleCellChange(st.id, 'hyP2Obt', e.target.value)}
                          className="w-full text-center font-mono font-bold text-purple-950 bg-white border border-purple-300 rounded py-1 px-1 focus:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                        />
                      </td>

                      {/* HY Practical (Enabled only if hasPractical is checked, else left blank) */}
                      <td className={`p-1 border-r border-slate-200 ${row.hasPractical ? 'bg-emerald-50/40' : 'bg-slate-100/60'}`}>
                        {row.hasPractical ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0-30"
                            value={row.hyPracObt}
                            onChange={e => handleCellChange(st.id, 'hyPracObt', e.target.value)}
                            className="w-full text-center font-mono font-bold text-emerald-950 bg-white border-2 border-emerald-400 rounded py-1 px-1 focus:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                          />
                        ) : (
                          <div className="text-center text-slate-300 font-mono text-[11px] select-none py-1" title="इस छात्र के लिए प्रैक्टिकल लागू नहीं है">
                            -
                          </div>
                        )}
                      </td>

                      {/* HY Total / Obt */}
                      <td className="p-1.5 border-r-2 border-slate-400 bg-indigo-50/80 font-mono font-black text-indigo-950 text-center">
                        {hyTotalObt > 0 ? hyTotalObt : (row.hyTestObt || row.hyP1Obt ? '0' : '-')}
                      </td>

                      {/* ------------------------------------------- */}
                      {/* ANNUAL INPUTS                               */}
                      {/* ------------------------------------------- */}
                      {/* Annual Test */}
                      <td className="p-1 border-r border-slate-200 bg-amber-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="-"
                          value={row.yTestObt}
                          onChange={e => handleCellChange(st.id, 'yTestObt', e.target.value)}
                          className="w-full text-center font-mono font-bold text-slate-900 bg-white border border-amber-300 rounded py-1 px-1 focus:bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                        />
                      </td>

                      {/* Annual Paper 1 */}
                      <td className="p-1 border-r border-slate-200 bg-indigo-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="-"
                          value={row.yP1Obt}
                          onChange={e => handleCellChange(st.id, 'yP1Obt', e.target.value)}
                          className="w-full text-center font-mono font-bold text-indigo-950 bg-white border border-indigo-300 rounded py-1 px-1 focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                        />
                      </td>

                      {/* Annual Paper 2 */}
                      <td className="p-1 border-r border-slate-200 bg-purple-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="-"
                          value={row.yP2Obt}
                          onChange={e => handleCellChange(st.id, 'yP2Obt', e.target.value)}
                          className="w-full text-center font-mono font-bold text-purple-950 bg-white border border-purple-300 rounded py-1 px-1 focus:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                        />
                      </td>

                      {/* Annual Practical */}
                      <td className={`p-1 border-r border-slate-200 ${row.hasPractical ? 'bg-emerald-50/40' : 'bg-slate-100/60'}`}>
                        {row.hasPractical ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0-30"
                            value={row.yPracObt}
                            onChange={e => handleCellChange(st.id, 'yPracObt', e.target.value)}
                            className="w-full text-center font-mono font-bold text-emerald-950 bg-white border-2 border-emerald-400 rounded py-1 px-1 focus:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                          />
                        ) : (
                          <div className="text-center text-slate-300 font-mono text-[11px] select-none py-1" title="इस छात्र के लिए प्रैक्टिकल लागू नहीं है">
                            -
                          </div>
                        )}
                      </td>

                      {/* Annual Total / Obt */}
                      <td className="p-1.5 border-r-2 border-slate-400 bg-purple-50/80 font-mono font-black text-purple-950 text-center">
                        {yTotalObt > 0 ? yTotalObt : (row.yTestObt || row.yP1Obt ? '0' : '-')}
                      </td>

                      {/* ------------------------------------------- */}
                      {/* FINAL CONSOLIDATED SUMMARY                  */}
                      {/* ------------------------------------------- */}
                      <td className="p-1.5 border-r border-slate-200 bg-slate-100 font-mono font-black text-slate-900 text-center">
                        {grandObt > 0 ? `${grandObt}/${grandMax}` : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 bg-blue-50/60 font-mono font-bold text-blue-900 text-center">
                        {grandObt > 0 ? `${percentage.toFixed(1)}%` : '-'}
                      </td>
                      <td className="p-1.5 bg-emerald-50 font-bold text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                          percentage >= 75 ? 'bg-emerald-100 text-emerald-800' :
                          percentage >= 50 ? 'bg-indigo-100 text-indigo-800' :
                          percentage >= 33 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'
                        }`}>
                          {grandObt > 0 ? grade : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save & Summary Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              कुल छात्र: <strong>{classStudents.length}</strong> | अंक भरे गए: <strong className="text-emerald-700">{stats.completed}</strong> | शेष: <strong className="text-amber-700">{stats.pending}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveMarksToDatabase}
              disabled={isSaving || classStudents.length === 0}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                isSaving 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>डेटाबेस में सेव हो रहा है (Saving)...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>सभी अंक सुरक्षित करें (Save All Marks)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
