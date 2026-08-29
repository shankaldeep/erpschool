import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import { type Student, type ExamMark, type ExamType } from '../types';
import { Card, Button, Label } from './UI';
import { Printer, Upload, RefreshCw, Award, BookOpen, CheckCircle, AlertCircle, FileText, X, Download, BarChart2, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { isSameGrade, isSameSubject, isValidPhotoUrl, isPracticalSubject, isNurseryOrKg, getDefaultSubjectsForGrade, getAllSubjectsForStudent } from '../utils/gradeHelper';
import { type SubjectRowData } from './reportCard/types';
import { ReportCardStyles } from './reportCard/ReportCardStyles';
import { ClassicPortraitTemplate } from './reportCard/ClassicPortraitTemplate';
import { PaperPortraitTemplate } from './reportCard/PaperPortraitTemplate';
import { LandscapeProTemplate } from './reportCard/LandscapeProTemplate';
import { PaperLandscapeTemplate } from './reportCard/PaperLandscapeTemplate';
import { NurseryKgPortraitTemplate } from './reportCard/NurseryKgPortraitTemplate';
import { NurseryKgLandscapeTemplate } from './reportCard/NurseryKgLandscapeTemplate';

interface StudentReportCardProps {
  student: Student;
  onClose?: () => void;
  allowEditPhoto?: boolean;
}

export function StudentReportCard({ student, onClose, allowEditPhoto = true }: StudentReportCardProps) {
  const { marks, updateStudent, activeAcademicSession, schools, currentUser, attendances, students, updateSchool } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States
  const [activeViewTab, setActiveViewTab] = useState<'transcript' | 'analytics'>('transcript');
  const [photoUploading, setPhotoUploading] = useState(false);
  const defaultTpl = student.reportCardTemplate || (isNurseryOrKg(student.grade) ? 'nursery_kg' : 'classic_portrait');
  const [selectedTemplate, setSelectedTemplate] = useState<'classic_portrait' | 'paper_i_ii_portrait' | 'landscape_new' | 'paper_i_ii_landscape' | 'nursery_kg' | 'nursery_kg_landscape'>(defaultTpl);
  const [photoLoadError, setPhotoLoadError] = useState(false);

  const isLandscape = selectedTemplate === 'landscape_new' || selectedTemplate === 'paper_i_ii_landscape' || selectedTemplate === 'nursery_kg_landscape';
  const activePhoto = isValidPhotoUrl(student.photoUrl) ? student.photoUrl : (isValidPhotoUrl(student.docStudentPhoto) ? student.docStudentPhoto : null);

  // School details
  const currentSchool = schools.find(school => school.id === currentUser?.schoolId);
  const brandColor = currentSchool?.reportCardColor || '#002060';

  const colorOptions = [
    { name: 'Classic Navy Blue', value: '#002060' },
    { name: 'Royal Blue', value: '#1e3a8a' },
    { name: 'Forest Green', value: '#065f46' },
    { name: 'Deep Crimson Red', value: '#991b1b' },
    { name: 'Plum Purple', value: '#5b21b6' },
    { name: 'Teal Green', value: '#0f766e' },
    { name: 'Maroon Red', value: '#800000' },
    { name: 'Charcoal Black', value: '#374151' }
  ];

  // Student specific marks matching the active session
  const sessionToUse = student.academicSession || activeAcademicSession;
  const studentMarks = marks.filter(m => m.studentId === student.id);
  
  // Comprehensive list of all subjects (curriculum defaults, student-specific, classmate subjects, and recorded marks)
  const studentSubjects = getAllSubjectsForStudent(student, students, marks);

  // Helper to determine Grade from Percentage based on 8-point grading scale
  const getGradeFromPercentage = (pct: number): string => {
    if (pct >= 91) return 'A1';
    if (pct >= 81) return 'A2';
    if (pct >= 71) return 'B1';
    if (pct >= 61) return 'B2';
    if (pct >= 51) return 'C1';
    if (pct >= 41) return 'C2';
    if (pct >= 33) return 'D';
    return 'E';
  };

  // Helper to determine Remark from Percentage
  const getRemarkFromPercentage = (pct: number): string => {
    if (pct >= 90) return 'OUTSTANDING';
    if (pct >= 80) return 'EXCELLENT';
    if (pct >= 70) return 'VERY GOOD';
    if (pct >= 50) return 'GOOD';
    if (pct >= 33) return 'SATISFACTORY';
    return 'NEEDS IMPROVEMENT';
  };

  // Calculate global totals dynamically across all subjects
  let totalHyTestObt = 0;
  let totalHyExamObt = 0;
  let totalHyPracObt = 0;
  let totalHyMax = 0;
  let totalHyObt = 0;

  let totalYTestObt = 0;
  let totalYExamObt = 0;
  let totalYPracObt = 0;
  let totalYMax = 0;
  let totalYObt = 0;

  let totalFinalMax = 0;
  let totalFinalObt = 0;

  const isSeniorGrade = ['Class 11', 'Class 12', '11th', '12th', '11', '12'].some(c => (student.grade || '').toLowerCase().includes(c.toLowerCase()));

  const subjectRows: SubjectRowData[] = studentSubjects.map(subject => {
    const isGradingOnly = isSeniorGrade && ['p.t.', 'p.t', 'physical education', 'pt', 'games', 'physical & health education'].includes(subject.toLowerCase().trim());
    const isSubjectPractical = isPracticalSubject(subject);

    const hyTest = studentMarks.find(m => isSameSubject(m.subject, subject) && m.examType === 'Half-Yearly Test');
    const hyExam = studentMarks.find(m => isSameSubject(m.subject, subject) && m.examType === 'Half-Yearly Exam');
    const hyPrac = studentMarks.find(m => isSameSubject(m.subject, subject) && (m.examType === 'Half-Yearly Practical' || m.examType === 'Practical Exam'));
    const hyOral = studentMarks.find(m => isSameSubject(m.subject, subject) && (m.examType === 'Half-Yearly Oral' || m.examType === 'Oral Exam'));

    const yTest = studentMarks.find(m => isSameSubject(m.subject, subject) && m.examType === 'Yearly Test');
    const yExam = studentMarks.find(m => isSameSubject(m.subject, subject) && m.examType === 'Yearly Exam');
    const yPrac = studentMarks.find(m => isSameSubject(m.subject, subject) && (m.examType === 'Yearly Practical' || m.examType === 'Practical Exam'));
    const yOral = studentMarks.find(m => isSameSubject(m.subject, subject) && (m.examType === 'Yearly Oral' || m.examType === 'Oral Exam'));

    // Paper II values (Half-Yearly)
    const hyPaper2Val = (hyExam && (hyExam as any).paper2Marks !== undefined)
      ? Number((hyExam as any).paper2Marks)
      : 0;
    const hyPaper2Max = (hyExam && (hyExam as any).paper2MaxMarks !== undefined && (hyExam as any).paper2MaxMarks > 0)
      ? Number((hyExam as any).paper2MaxMarks)
      : ((hyExam && (hyExam as any).paper2Marks !== undefined) ? 35 : 0);
    const hyPaper2Exists = !!(hyExam && ((hyExam as any).paper2Marks !== undefined || ((hyExam as any).paper2MaxMarks !== undefined && (hyExam as any).paper2MaxMarks > 0)));
    const hasHyPaper2 = hyPaper2Exists && ((hyExam as any).paper2Marks !== undefined || (hyExam as any).paper2MaxMarks > 0);

    // Practical values
    const hyPracVal = (hyExam && hyExam.practicalMarks !== undefined)
      ? Number(hyExam.practicalMarks)
      : ((hyExam && (hyExam as any).practicalMarksObtained !== undefined)
          ? Number((hyExam as any).practicalMarksObtained)
          : (hyPrac ? Number(hyPrac.marksObtained) : 0));

    const isHyPractical = isSubjectPractical || (hyExam && ((hyExam.practicalMaxMarks && hyExam.practicalMaxMarks > 0) || hyExam.practicalMarks !== undefined || (hyExam as any).practicalMarksObtained !== undefined)) || !!hyPrac;

    const hyPracMax = (hyExam && hyExam.practicalMaxMarks !== undefined && hyExam.practicalMaxMarks > 0)
      ? Number(hyExam.practicalMaxMarks)
      : (hyPrac ? Number(hyPrac.maxMarks) : (isHyPractical && (hyPracVal > 0 || !!hyPrac) ? 30 : (isSubjectPractical ? 30 : 0)));

    const hasHyPracData = (hyExam && (hyExam.practicalMarks !== undefined || (hyExam as any).practicalMarksObtained !== undefined)) || !!hyPrac;
    const hasHyPrac = hasHyPracData || (hyExam && hyExam.practicalMaxMarks !== undefined && hyExam.practicalMaxMarks > 0) || (isSubjectPractical && hyPracVal > 0);

    // Oral values
    const hyOralVal = (hyExam && (hyExam as any).oralMarks !== undefined)
      ? Number((hyExam as any).oralMarks)
      : (hyOral ? Number(hyOral.marksObtained) : 0);
    const hyOralMax = (hyExam && (hyExam as any).oralMaxMarks !== undefined && (hyExam as any).oralMaxMarks > 0)
      ? Number((hyExam as any).oralMaxMarks)
      : (hyOral ? Number(hyOral.maxMarks) : 0);
    const hyOralExists = (hyExam && (hyExam as any).oralMarks !== undefined) || !!hyOral || hyOralVal > 0;
    const hasHyOral = !hasHyPrac && (hyOralExists || hyOralMax > 0);

    // Written / Theory & Test (Half-Yearly)
    const hyTestVal = hyTest ? Number(hyTest.marksObtained) : 0;
    const hyTestMax = hyTest ? (Number(hyTest.maxMarks) || 10) : 10;
    const hyExamVal = hyExam ? Number(hyExam.marksObtained) : 0;
    let defaultHyTheoryMax = hasHyPaper2
      ? (hasHyPrac ? 35 : (hyPaper2Max === 35 ? 35 : Math.max(0, 100 - hyTestMax - hyPaper2Max)))
      : (hasHyPrac ? (hyPracMax === 30 ? 60 : Math.max(0, 100 - hyTestMax - hyPracMax)) : (hasHyOral ? Math.max(0, 90 - hyOralMax) : 90));
    let hyExamMax = hyExam && hyExam.maxMarks !== undefined && hyExam.maxMarks !== null
      ? Number(hyExam.maxMarks)
      : defaultHyTheoryMax;

    const hasHy = !!(hyTest || hyExam || hyPrac || hyOral || (hyExam && ((hyExam as any).oralMarks !== undefined || hyExam.practicalMarks !== undefined || (hyExam as any).paper2Marks !== undefined)));
    
    let hyMax = 0;
    let hyObt = 0;
    if (hasHy) {
      if (hyTest) {
        hyMax += hyTestMax;
        hyObt += hyTestVal;
      }
      if (hyExam) {
        hyMax += hyExamMax;
        hyObt += hyExamVal;
      }
      if (hasHyPaper2) {
        hyMax += hyPaper2Max;
        hyObt += hyPaper2Val;
      }
      if (hasHyPrac) {
        hyMax += hyPracMax;
        hyObt += hyPracVal;
      } else if (hasHyOral) {
        hyMax += hyOralMax;
        hyObt += hyOralVal;
      }
    }

    // Paper II values (Yearly)
    const yPaper2Val = (yExam && (yExam as any).paper2Marks !== undefined)
      ? Number((yExam as any).paper2Marks)
      : 0;
    const yPaper2Max = (yExam && (yExam as any).paper2MaxMarks !== undefined && (yExam as any).paper2MaxMarks > 0)
      ? Number((yExam as any).paper2MaxMarks)
      : ((yExam && (yExam as any).paper2Marks !== undefined) ? 35 : 0);
    const yPaper2Exists = !!(yExam && ((yExam as any).paper2Marks !== undefined || ((yExam as any).paper2MaxMarks !== undefined && (yExam as any).paper2MaxMarks > 0)));
    const hasYPaper2 = yPaper2Exists && ((yExam as any).paper2Marks !== undefined || (yExam as any).paper2MaxMarks > 0);

    // Practical values (Yearly)
    const yPracVal = (yExam && yExam.practicalMarks !== undefined)
      ? Number(yExam.practicalMarks)
      : ((yExam && (yExam as any).practicalMarksObtained !== undefined)
          ? Number((yExam as any).practicalMarksObtained)
          : (yPrac ? Number(yPrac.marksObtained) : 0));

    const isYPractical = isSubjectPractical || (yExam && ((yExam.practicalMaxMarks && yExam.practicalMaxMarks > 0) || yExam.practicalMarks !== undefined || (yExam as any).practicalMarksObtained !== undefined)) || !!yPrac;

    const yPracMax = (yExam && yExam.practicalMaxMarks !== undefined && yExam.practicalMaxMarks > 0)
      ? Number(yExam.practicalMaxMarks)
      : (yPrac ? Number(yPrac.maxMarks) : (isYPractical && (yPracVal > 0 || !!yPrac) ? 30 : (isSubjectPractical ? 30 : 0)));

    const hasYPracData = (yExam && (yExam.practicalMarks !== undefined || (yExam as any).practicalMarksObtained !== undefined)) || !!yPrac;
    const hasYPrac = hasYPracData || (yExam && yExam.practicalMaxMarks !== undefined && yExam.practicalMaxMarks > 0) || (isYPractical && yPracVal > 0);

    // Oral values (Yearly)
    const yOralVal = (yExam && (yExam as any).oralMarks !== undefined)
      ? Number((yExam as any).oralMarks)
      : (yOral ? Number(yOral.marksObtained) : 0);
    const yOralMax = (yExam && (yExam as any).oralMaxMarks !== undefined && (yExam as any).oralMaxMarks > 0)
      ? Number((yExam as any).oralMaxMarks)
      : (yOral ? Number(yOral.maxMarks) : 0);
    const yOralExists = (yExam && (yExam as any).oralMarks !== undefined) || !!yOral || yOralVal > 0;
    const hasYOral = !hasYPrac && (yOralExists || yOralMax > 0);

    const yTestVal = yTest ? Number(yTest.marksObtained) : 0;
    const yTestMax = yTest ? (Number(yTest.maxMarks) || 10) : 10;
    const yExamVal = yExam ? Number(yExam.marksObtained) : 0;
    let defaultYTheoryMax = hasYPaper2
      ? (hasYPrac ? 35 : (yPaper2Max === 35 ? 35 : Math.max(0, 100 - yTestMax - yPaper2Max)))
      : (hasYPrac ? (yPracMax === 30 ? 60 : Math.max(0, 100 - yTestMax - yPracMax)) : (hasYOral ? Math.max(0, 90 - yOralMax) : 90));
    let yExamMax = yExam && yExam.maxMarks !== undefined && yExam.maxMarks !== null
      ? Number(yExam.maxMarks)
      : defaultYTheoryMax;

    const hasY = !!(yTest || yExam || yPrac || yOral || (yExam && ((yExam as any).oralMarks !== undefined || yExam.practicalMarks !== undefined || (yExam as any).paper2Marks !== undefined)));
    
    let yMax = 0;
    let yObt = 0;
    if (hasY) {
      if (yTest) {
        yMax += yTestMax;
        yObt += yTestVal;
      }
      if (yExam) {
        yMax += yExamMax;
        yObt += yExamVal;
      }
      if (hasYPaper2) {
        yMax += yPaper2Max;
        yObt += yPaper2Val;
      }
      if (hasYPrac) {
        yMax += yPracMax;
        yObt += yPracVal;
      } else if (hasYOral) {
        yMax += yOralMax;
        yObt += yOralVal;
      }
    }

    const hasAny = hasHy || hasY;

    // Final total
    const finalMax = (hasHy ? hyMax : 0) + (hasY ? yMax : 0);
    const finalObt = (hasHy ? hyObt : 0) + (hasY ? yObt : 0);

    const percentage = finalMax > 0 ? (finalObt / finalMax) * 100 : 0;
    const grade = finalMax > 0 ? getGradeFromPercentage(percentage) : '-';

    if (!isGradingOnly) {
      if (hasHy) {
        totalHyTestObt += (hyTest ? hyTestVal : 0);
        totalHyExamObt += (hyExam ? hyExamVal : 0) + (hasHyPaper2 ? hyPaper2Val : 0);
        totalHyPracObt += hasHyPrac ? hyPracVal : (hasHyOral ? hyOralVal : 0);
        totalHyMax += hyMax;
        totalHyObt += hyObt;
      }
      if (hasY) {
        totalYTestObt += (yTest ? yTestVal : 0);
        totalYExamObt += (yExam ? yExamVal : 0) + (hasYPaper2 ? yPaper2Val : 0);
        totalYPracObt += hasYPrac ? yPracVal : (hasYOral ? yOralVal : 0);
        totalYMax += yMax;
        totalYObt += yObt;
      }
      totalFinalMax += finalMax;
      totalFinalObt += finalObt;
    }

    return {
      subject,
      isGradingOnly,
      isSubjectPractical,
      hasHy,
      hasY,
      hasAny,
      hasHyOral,
      hasHyPrac,
      hasHyPaper2,
      hasYOral,
      hasYPrac,
      hasYPaper2,
      hyTestVal,
      hyExamVal,
      hyPaper2Val,
      hyOralVal,
      hyPracVal,
      hyTestMax,
      hyExamMax,
      hyPaper2Max,
      hyOralMax,
      hyPracMax,
      hyMax,
      hyObt,
      yTestVal,
      yExamVal,
      yPaper2Val,
      yOralVal,
      yPracVal,
      yTestMax,
      yExamMax,
      yPaper2Max,
      yOralMax,
      yPracMax,
      yMax,
      yObt,
      finalMax,
      finalObt,
      grade,
      hyTestExists: !!hyTest,
      hyExamExists: !!hyExam,
      hyPaper2Exists,
      hyOralExists,
      hyPracExists: hasHyPracData,
      yTestExists: !!yTest,
      yExamExists: !!yExam,
      yPaper2Exists,
      yOralExists,
      yPracExists: hasYPracData,
    };
  });

  const overallPercentage = totalFinalMax > 0 ? (totalFinalObt / totalFinalMax) * 100 : 0;
  const overallGrade = totalFinalMax > 0 ? getGradeFromPercentage(overallPercentage) : 'E';
  const remark = totalFinalMax > 0 ? getRemarkFromPercentage(overallPercentage) : 'NEEDS IMPROVEMENT';
  const passed = overallPercentage >= 33;

  // Calculate Student Rank inside Class
  const rank = (() => {
    const classStudents = students.filter(s => !s.isDeleted && isSameGrade(s.grade, student.grade) && (!s.schoolId || !student.schoolId || s.schoolId === student.schoolId));
    if (classStudents.length <= 1) return '1 / 1';
    
    const scores = classStudents.map(s => {
      const sMarks = marks.filter(m => m.studentId === s.id);
      const totalObt = sMarks.reduce((sum, m) => sum + (Number(m.marksObtained) || 0) + (Number((m as any).paper2Marks) || 0) + (Number((m as any).practicalMarks) || 0) + (Number((m as any).oralMarks) || 0), 0);
      return { studentId: s.id, totalObt };
    });
    
    scores.sort((a, b) => b.totalObt - a.totalObt);
    const myIndex = scores.findIndex(item => item.studentId === student.id);
    return myIndex !== -1 ? `${myIndex + 1} / ${classStudents.length}` : '-';
  })();

  // Calculate Attendance dynamically
  const studentAttendance = attendances.filter(a => a.studentId === student.id || a.userId === student.id);
  const totalPresent = (student.reportCardPresentDays !== undefined && student.reportCardPresentDays !== null)
    ? student.reportCardPresentDays
    : (studentAttendance.length > 0 ? studentAttendance.filter(a => a.status === 'Present').length : 194);
  const totalDays = (student.reportCardTotalDays !== undefined && student.reportCardTotalDays !== null)
    ? student.reportCardTotalDays
    : (studentAttendance.length > 0 ? studentAttendance.length : 220);
  const attendanceString = `${totalPresent} / ${totalDays}`;

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Str = reader.result as string;
      updateStudent(student.id, { photoUrl: base64Str });
      setPhotoLoadError(false);
      setPhotoUploading(false);
    };
    reader.onerror = () => {
      setPhotoUploading(false);
      alert('Error reading file. Please try smaller or standard images.');
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = () => {
    window.print();
  };

  // Recharts Chart Data (Online view only)
  const chartData = subjectRows
    .filter(s => s.hasAny)
    .map(s => ({
      subject: s.subject,
      'Obtained Marks': s.finalObt,
      'Max Marks': s.finalMax,
      percentage: s.finalMax > 0 ? Math.round((s.finalObt / s.finalMax) * 100) : 0
    }));

  const commonProps = {
    student,
    currentSchool,
    sessionToUse,
    subjectRows,
    totalHyMax,
    totalHyObt,
    totalYMax,
    totalYObt,
    totalFinalMax,
    totalFinalObt,
    overallPercentage,
    overallGrade,
    remark,
    passed,
    rank,
    attendanceString,
    activePhoto,
    photoLoadError,
    setPhotoLoadError,
    allowEditPhoto,
    onPhotoUploadClick: () => fileInputRef.current?.click(),
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:backdrop-none print:z-0">
      <Card className={`w-full ${isLandscape ? 'max-w-5xl' : 'max-w-4xl'} bg-white shadow-2xl rounded-2xl border border-slate-200 overflow-hidden relative flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none transition-all duration-300`}>
        
        {/* Controls - Hidden in print */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 print:hidden shrink-0 no-print gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <span className="font-bold text-slate-800 text-sm block">Academic Transcript Console</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{student.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Manual Attendance Overrides */}
            <div className="flex items-center gap-2 mr-4 bg-white px-2 py-1 border border-slate-200 rounded-lg">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Attendance</div>
              <input 
                type="number" 
                placeholder="Present" 
                title="Present Days"
                className="w-14 text-xs p-1 border border-slate-200 rounded text-center font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                value={student.reportCardPresentDays ?? ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateStudent(student.id, { reportCardPresentDays: isNaN(val) ? undefined : val });
                }}
              />
              <span className="text-slate-400 font-bold">/</span>
              <input 
                type="number" 
                placeholder="Total" 
                title="Total Days"
                className="w-14 text-xs p-1 border border-slate-200 rounded text-center font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                value={student.reportCardTotalDays ?? ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateStudent(student.id, { reportCardTotalDays: isNaN(val) ? undefined : val });
                }}
              />
            </div>

            {/* View Tab Toggles */}
            <div className="flex border border-slate-200 rounded-lg p-0.5 bg-white mr-2">
              <button
                onClick={() => setActiveViewTab('transcript')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors ${activeViewTab === 'transcript' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Transcript Preview</span>
              </button>
              <button
                onClick={() => setActiveViewTab('analytics')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors ${activeViewTab === 'analytics' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Analytics Chart</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Template:</span>
              <select
                value={selectedTemplate}
                onChange={async (e) => {
                  const val = e.target.value as any;
                  setSelectedTemplate(val);
                  if (currentUser?.role === 'TEACHER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MASTER_ADMIN' || currentUser?.role === 'CLERK') {
                    await updateStudent(student.id, { reportCardTemplate: val });
                  }
                }}
                className="text-xs border-slate-200 rounded px-2.5 py-1.5 bg-white border font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="classic_portrait">Classic Portrait (Writ / Prac)</option>
                <option value="landscape_new">Landscape Pro (Writ / Prac)</option>
                <option value="paper_i_ii_portrait">Paper I &amp; II (Portrait)</option>
                <option value="paper_i_ii_landscape">Paper I &amp; II (Landscape A4)</option>
                <option value="nursery_kg">Nursery / KG (Portrait)</option>
                <option value="nursery_kg_landscape">Nursery / KG (Landscape A4)</option>
              </select>
            </div>

            {(currentUser?.role === 'TEACHER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MASTER_ADMIN' || currentUser?.role === 'CLERK') && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Theme Color:</span>
                <select
                  value={brandColor}
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (currentSchool?.id) {
                      try {
                        await updateSchool(currentSchool.id, { reportCardColor: val });
                      } catch (err) {
                        console.error('Failed to update school brand color', err);
                      }
                    }
                  }}
                  className="text-xs border-slate-200 rounded px-2 py-1.5 bg-white border font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {colorOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-1.5 px-3.5 flex items-center gap-1.5 rounded-lg shadow-sm">
              <Printer className="w-4 h-4" />
              <span>Print Report Card</span>
            </Button>
            
            {onClose && (
              <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors ml-1">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Transcript Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 print:overflow-visible print:p-0">
          
          <ReportCardStyles isLandscape={isLandscape} brandColor={brandColor} />

          {activeViewTab === 'analytics' && (
            <div className="space-y-6 no-print">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Marks</span>
                  <p className="text-2xl font-black text-slate-800 font-mono mt-1">{totalFinalObt} / {totalFinalMax}</p>
                </div>
                <div className="p-4 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregated Percentage</span>
                  <p className="text-2xl font-black text-indigo-600 font-mono mt-1">{overallPercentage.toFixed(2)}%</p>
                </div>
                <div className="p-4 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Final Board Grade</span>
                  <p className="text-2xl font-black text-emerald-600 font-mono mt-1">{overallGrade}</p>
                </div>
              </div>

              <Card className="p-4 bg-white border">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Subject Performance Breakdown (Final Obtained vs. Max)
                </h3>
                {chartData.length === 0 ? (
                  <p className="text-slate-400 italic text-xs text-center py-10">No examination records logged yet to render chart visualization.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#64748b" />
                        <Tooltip />
                        <Bar dataKey="Obtained Marks" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.percentage >= 75 ? '#059669' : entry.percentage >= 50 ? '#4f46e5' : entry.percentage >= 33 ? '#d97706' : '#dc2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* PRINT CARD WRAPPER */}
          <div 
            className={`report-card-container print-container bg-white traditional-border border-[5px] border-double border-[#002060] ${isLandscape ? 'p-3 sm:p-4' : 'p-5 sm:p-6'} m-2 rounded-xl shadow-lg relative overflow-hidden ${activeViewTab === 'analytics' ? 'hidden print:block' : 'block'}`}
            style={{ '--rc-color': brandColor } as React.CSSProperties}
          >
            {/* hidden upload input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              accept="image/*" 
              className="hidden" 
            />

            {selectedTemplate === 'classic_portrait' && (
              <ClassicPortraitTemplate {...commonProps} />
            )}

            {selectedTemplate === 'paper_i_ii_portrait' && (
              <PaperPortraitTemplate {...commonProps} />
            )}

            {selectedTemplate === 'landscape_new' && (
              <LandscapeProTemplate {...commonProps} />
            )}

            {selectedTemplate === 'paper_i_ii_landscape' && (
              <PaperLandscapeTemplate {...commonProps} />
            )}

            {selectedTemplate === 'nursery_kg' && (
              <NurseryKgPortraitTemplate {...commonProps} />
            )}

            {selectedTemplate === 'nursery_kg_landscape' && (
              <NurseryKgLandscapeTemplate {...commonProps} />
            )}

          </div>
        </div>

      </Card>
    </div>
  );
}
