import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { 
  User, Student, Teacher, ParentAccount, Homework, ExamMark, FeeRecord, Issue, School, 
  AttendanceRecord, NotificationLog, SessionRequest, AttendanceRequest 
} from './types';
import { isSameSubject, normalizeSubject } from './utils/gradeHelper';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, signInWithGoogle, logoutFirebase } from './firebase';

// Helper to safely read from localStorage
const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

// Helper to safely write to localStorage
const setLocalStorageItem = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
};

// Initial Default Data (Seeded on first local load)
const initialSchools: School[] = [
  { 
    id: 'sch1', 
    name: 'Hogwarts School of Witchcraft and Wizardry', 
    address: 'Highlands, Scotland',
    mobile: '9876543210',
    email: 'admin@school.edu',
    createdAt: new Date().toISOString(),
    features: ['registration', 'fees', 'homework', 'attendance', 'marks', 'tc', 'idcard']
  }
];

const initialUsers: User[] = [
  { id: 'ma1', name: 'Shankal Deep', role: 'MASTER_ADMIN', email: 'zshankal6@gmail.com', password: 'Shan@1234' },
  { id: 'ma2', name: 'Master Admin', role: 'MASTER_ADMIN', email: 'SHANKALDEEP', password: 'Shan@1234' },
  { id: 'a1', name: 'Albus Dumbledore', role: 'ADMIN', email: 'admin@school.edu', password: 'Admin@1234', schoolId: 'sch1' },
  { id: 'c1', name: 'Arthur Weasley', role: 'CLERK', email: 'clerk@school.edu', password: 'password123', schoolId: 'sch1' },
];

const initialTeachers: Teacher[] = [
  { id: 't1', name: 'Minerva McGonagall', role: 'TEACHER', email: 'minerva@school.edu', password: 'password123', subjects: ['Math', 'Science'], schoolId: 'sch1' },
  { id: 't2', name: 'Severus Snape', role: 'TEACHER', email: 'severus@school.edu', password: 'password123', subjects: ['Chemistry', 'History'], schoolId: 'sch1' },
];

const initialStudents: Student[] = [
  { id: 's1', name: 'Harry Potter', role: 'STUDENT', email: 'harry@school.edu', password: 'password123', grade: 'Class 10', rollNo: '101', feeBalance: 5000, schoolId: 'sch1', academicSession: '2026-27' },
  { id: 's2', name: 'Hermione Granger', role: 'STUDENT', email: 'hermione@school.edu', password: 'password123', grade: 'Class 10', rollNo: '102', feeBalance: 0, schoolId: 'sch1', academicSession: '2026-27' },
  { id: 's3', name: 'Ron Weasley', role: 'STUDENT', email: 'ron@school.edu', password: 'password123', grade: 'Class 9', rollNo: '901', feeBalance: 12000, schoolId: 'sch1', academicSession: '2026-27' },
];

const initialHomeworks: Homework[] = [
  { id: 'hw1', schoolId: 'sch1', teacherId: 't1', grade: 'Class 10', subject: 'Math', title: 'Algebra Equations', description: 'Solve exercise 4.1 completely.', date: new Date().toISOString() }
];

const initialClassFees: Record<string, Record<string, number>> = {
  'sch1': {
    'Class 10': 30000,
    'Class 9': 25000
  }
};

const getLifetimeSessions = (): string[] => {
  const sessions: string[] = [];
  for (let year = 2023; year <= 2050; year++) {
    const nextYearShort = (year + 1) % 100;
    const nextYearStr = nextYearShort < 10 ? `0${nextYearShort}` : `${nextYearShort}`;
    sessions.push(`${year}-${nextYearStr}`);
  }
  return sessions;
};

export interface LocalBackupSnapshot {
  id: string;
  schoolId: string;
  schoolName: string;
  exportedAt: string;
  studentsCount: number;
  marksCount: number;
  attendancesCount: number;
  feeRecordsCount: number;
  size: string;
  snapshot: string;
}

interface StoreState {
  schools: School[];
  users: User[];
  students: Student[];
  allStudents: Student[];
  deletedStudents: Student[];
  teachers: Teacher[];
  homeworks: Homework[];
  marks: ExamMark[];
  allMarks: ExamMark[];
  feeRecords: FeeRecord[];
  allFeeRecords: FeeRecord[];
  issues: Issue[];
  attendances: AttendanceRecord[];
  notificationLogs: NotificationLog[];
  currentUser: User | null;
  classFees: Record<string, number>;
  activeAcademicSession: string;
  academicSessions: string[];
  allowedSessions: string[];
  sessionRequests: SessionRequest[];
  attendanceRequests: AttendanceRequest[];
  parentAccounts: ParentAccount[];
  localBackups: LocalBackupSnapshot[];
}

interface StoreContextType extends StoreState {
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  setActiveAcademicSession: (session: string) => void;
  addAcademicSession: (session: string) => void;
  editAcademicSession: (oldSession: string, newSession: string) => void;
  deleteAcademicSession: (session: string) => void;
  setAllowedSessions: (sessions: string[]) => void;
  addSchool: (payload: any) => void;
  updateSchool: (id: string, updates: Partial<School> & { adminPass?: string }) => void;
  updateSchoolFeatures: (id: string, features: string[]) => void;
  deleteSchool: (id: string) => void;
  addStudent: (student: Student) => void;
  importStudents: (students: Student[]) => void;
  deleteStudent: (id: string) => void;
  restoreStudent: (id: string) => void;
  hardDeleteStudent: (id: string) => void;
  deleteAllStudentsInSchool: (schoolId: string) => Promise<void>;
  addTeacher: (teacher: Teacher) => void;
  deleteTeacher: (id: string) => void;
  addClerk: (clerk: User) => void;
  deleteClerk: (id: string) => void;
  addParentAccount: (parent: ParentAccount) => void;
  updateParentAccount: (id: string, updates: Partial<ParentAccount>) => void;
  deleteParentAccount: (id: string) => void;
  addHomework: (hw: Omit<Homework, 'id' | 'date' | 'schoolId'>) => void;
  addMark: (mark: Omit<ExamMark, 'id' | 'date' | 'schoolId'>) => void;
  importMarks: (marks: Omit<ExamMark, 'id' | 'date' | 'schoolId'>[]) => void;
  addFeePayment: (studentId: string, amount: number, month: string, remarks: string, receiptNo?: string) => FeeRecord;
  importFeeRecords: (records: FeeRecord[]) => void;
  deleteFeePayment: (id: string) => void;
  addIssue: (description: string) => void;
  resolveIssue: (issueId: string) => void;
  setClassFee: (grade: string, amount: number) => void;
  setClassFeesBatch: (grade: string, amount: number, halfYearly: number, yearly: number) => void;
  getStudentBalance: (studentId: string) => { total: number, previous: number, current: number, paid: number, balance: number, concession?: number };
  updateStudent: (studentId: string, updates: Partial<Student>) => void;
  saveAttendance: (records: AttendanceRecord[]) => Promise<void>;
  addNotificationLog: (log: Omit<NotificationLog, 'id' | 'schoolId' | 'timestamp'>) => Promise<void>;
  requestSessionApproval: (session: string) => Promise<void>;
  approveSessionRequest: (requestId: string) => Promise<void>;
  deleteSessionRequest: (requestId: string) => Promise<void>;
  submitAttendanceRequest: (req: Omit<AttendanceRequest, 'id' | 'schoolId' | 'status' | 'requestedAt'>) => Promise<void>;
  approveAttendanceRequest: (requestId: string) => Promise<void>;
  rejectAttendanceRequest: (requestId: string) => Promise<void>;
  // Offline & Local Disk backup methods
  createLocalBackupSnapshot: (schoolId: string) => LocalBackupSnapshot;
  restoreFromLocalBackupSnapshot: (snapshotId: string, rawSnapshotStr?: string) => number;
  exportFullDiskBackup: () => void;
  importFullDiskBackup: (jsonContent: string) => boolean;
  schoolConfigs: Record<string, { activeAcademicSession: string, academicSessions: string[], allowedSessions: string[] }>;
  classFeesData: Record<string, Record<string, number>>;
  saveSchoolConfig: (schoolId: string, config: { activeAcademicSession: string, academicSessions: string[], allowedSessions: string[] }) => void;
  saveSchoolFees: (schoolId: string, fees: Record<string, number>) => void;
  loginWithGoogle: () => Promise<boolean>;
  isCloudSynced: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  // 100% Local Storage State Initialization
  const [schools, setSchools] = useState<School[]>(() => getLocalStorageItem('local_edumanage_schools', initialSchools));
  const [users, setUsers] = useState<User[]>(() => getLocalStorageItem('local_edumanage_users', initialUsers));
  const [students, setStudents] = useState<Student[]>(() => getLocalStorageItem('local_edumanage_students', initialStudents));
  const [teachers, setTeachers] = useState<Teacher[]>(() => getLocalStorageItem('local_edumanage_teachers', initialTeachers));
  const [homeworks, setHomeworks] = useState<Homework[]>(() => getLocalStorageItem('local_edumanage_homeworks', initialHomeworks));
  const [marks, setMarks] = useState<ExamMark[]>(() => getLocalStorageItem('local_edumanage_marks', []));
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() => getLocalStorageItem('local_edumanage_feeRecords', []));
  const [issues, setIssues] = useState<Issue[]>(() => getLocalStorageItem('local_edumanage_issues', []));
  const [attendances, setAttendances] = useState<AttendanceRecord[]>(() => getLocalStorageItem('local_edumanage_attendances', []));
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() => getLocalStorageItem('local_edumanage_notificationLogs', []));
  const [sessionRequests, setSessionRequests] = useState<SessionRequest[]>(() => getLocalStorageItem('local_edumanage_sessionRequests', []));
  const [attendanceRequests, setAttendanceRequests] = useState<AttendanceRequest[]>(() => getLocalStorageItem('local_edumanage_attendanceRequests', []));
  const [parentAccounts, setParentAccounts] = useState<ParentAccount[]>(() => getLocalStorageItem('local_edumanage_parentAccounts', []));
  const [localBackups, setLocalBackups] = useState<LocalBackupSnapshot[]>(() => getLocalStorageItem('local_edumanage_backups', []));

  const [classFeesData, setClassFeesData] = useState<Record<string, Record<string, number>>>(() => 
    getLocalStorageItem('local_edumanage_classFees', initialClassFees)
  );

  const [schoolConfigs, setSchoolConfigs] = useState<Record<string, { activeAcademicSession: string, academicSessions: string[], allowedSessions: string[] }>>(() => 
    getLocalStorageItem('local_edumanage_schoolConfigs', {
      'sch1': {
        activeAcademicSession: '2026-27',
        academicSessions: getLifetimeSessions(),
        allowedSessions: getLifetimeSessions()
      }
    })
  );

  const [currentUser, setCurrentUser] = useState<User | null>(() => getLocalStorageItem('sch_currentUser', null));
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const isInitialCloudLoad = useRef<boolean>(true);
  const isRemoteUpdate = useRef<boolean>(false);
  const lastSyncedHash = useRef<string>('');

  // Firestore Real-Time Cloud Listener
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    try {
      const docRef = doc(db, 'system_data', 'database_state');
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data) {
            const dataHash = JSON.stringify({
              schools: data.schools,
              users: data.users,
              students: data.students,
              teachers: data.teachers,
              homeworks: data.homeworks,
              marks: data.marks,
              feeRecords: data.feeRecords,
              issues: data.issues,
              attendances: data.attendances,
              notificationLogs: data.notificationLogs,
              sessionRequests: data.sessionRequests,
              attendanceRequests: data.attendanceRequests,
              parentAccounts: data.parentAccounts,
              classFeesData: data.classFeesData,
              schoolConfigs: data.schoolConfigs,
              localBackups: data.localBackups
            });

            if (dataHash !== lastSyncedHash.current) {
              isRemoteUpdate.current = true;
              lastSyncedHash.current = dataHash;

              if (data.schools && Array.isArray(data.schools)) setSchools(data.schools);
              if (data.users && Array.isArray(data.users)) setUsers(data.users);
              if (data.students && Array.isArray(data.students)) setStudents(data.students);
              if (data.teachers && Array.isArray(data.teachers)) setTeachers(data.teachers);
              if (data.homeworks && Array.isArray(data.homeworks)) setHomeworks(data.homeworks);
              if (data.marks && Array.isArray(data.marks)) setMarks(data.marks);
              if (data.feeRecords && Array.isArray(data.feeRecords)) setFeeRecords(data.feeRecords);
              if (data.issues && Array.isArray(data.issues)) setIssues(data.issues);
              if (data.attendances && Array.isArray(data.attendances)) setAttendances(data.attendances);
              if (data.notificationLogs && Array.isArray(data.notificationLogs)) setNotificationLogs(data.notificationLogs);
              if (data.sessionRequests && Array.isArray(data.sessionRequests)) setSessionRequests(data.sessionRequests);
              if (data.attendanceRequests && Array.isArray(data.attendanceRequests)) setAttendanceRequests(data.attendanceRequests);
              if (data.parentAccounts && Array.isArray(data.parentAccounts)) setParentAccounts(data.parentAccounts);
              if (data.classFeesData) setClassFeesData(data.classFeesData);
              if (data.schoolConfigs) setSchoolConfigs(data.schoolConfigs);
              if (data.localBackups && Array.isArray(data.localBackups)) setLocalBackups(data.localBackups);
            }
            setIsCloudSynced(true);
          }
        } else {
          // Initialize Firestore state with current data once
          const initialPayload = {
            schools,
            users,
            students,
            teachers,
            homeworks,
            marks,
            feeRecords,
            issues,
            attendances,
            notificationLogs,
            sessionRequests,
            attendanceRequests,
            parentAccounts,
            classFeesData,
            schoolConfigs,
            localBackups
          };
          lastSyncedHash.current = JSON.stringify(initialPayload);
          setDoc(docRef, {
            ...initialPayload,
            updatedAt: new Date().toISOString()
          }, { merge: true }).then(() => {
            setIsCloudSynced(true);
          }).catch((err) => {
            console.warn("Initial Firestore write notice:", err);
          });
        }
        isInitialCloudLoad.current = false;
      }, (err) => {
        console.warn("Firestore sync notification:", err);
      });
    } catch (e) {
      console.warn("Firestore connection not available, fallback to offline storage:", e);
    }

    return () => unsubscribe();
  }, []);

  // Save changes to Firestore on local state change (Debounced & Loop-Protected)
  useEffect(() => {
    if (isInitialCloudLoad.current) return;

    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const currentPayload = {
      schools,
      users,
      students,
      teachers,
      homeworks,
      marks,
      feeRecords,
      issues,
      attendances,
      notificationLogs,
      sessionRequests,
      attendanceRequests,
      parentAccounts,
      classFeesData,
      schoolConfigs,
      localBackups
    };
    const currentHash = JSON.stringify(currentPayload);

    if (currentHash === lastSyncedHash.current) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        const docRef = doc(db, 'system_data', 'database_state');
        lastSyncedHash.current = currentHash;
        setDoc(docRef, {
          ...currentPayload,
          updatedAt: new Date().toISOString()
        }, { merge: true }).then(() => {
          setIsCloudSynced(true);
        }).catch((err) => {
          console.warn("Cloud push deferred:", err);
        });
      } catch (err) {
        console.warn("Cloud sync write error:", err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    schools, users, students, teachers, homeworks, marks, feeRecords, 
    issues, attendances, notificationLogs, sessionRequests, 
    attendanceRequests, parentAccounts, classFeesData, schoolConfigs, localBackups
  ]);

  // Sync state changes automatically to localStorage (Immediate persistence)
  useEffect(() => { setLocalStorageItem('local_edumanage_schools', schools); }, [schools]);
  useEffect(() => { setLocalStorageItem('local_edumanage_users', users); }, [users]);
  useEffect(() => { setLocalStorageItem('local_edumanage_students', students); }, [students]);
  useEffect(() => { setLocalStorageItem('local_edumanage_teachers', teachers); }, [teachers]);
  useEffect(() => { setLocalStorageItem('local_edumanage_homeworks', homeworks); }, [homeworks]);
  useEffect(() => { setLocalStorageItem('local_edumanage_marks', marks); }, [marks]);
  useEffect(() => { setLocalStorageItem('local_edumanage_feeRecords', feeRecords); }, [feeRecords]);
  useEffect(() => { setLocalStorageItem('local_edumanage_issues', issues); }, [issues]);
  useEffect(() => { setLocalStorageItem('local_edumanage_attendances', attendances); }, [attendances]);
  useEffect(() => { setLocalStorageItem('local_edumanage_notificationLogs', notificationLogs); }, [notificationLogs]);
  useEffect(() => { setLocalStorageItem('local_edumanage_sessionRequests', sessionRequests); }, [sessionRequests]);
  useEffect(() => { setLocalStorageItem('local_edumanage_attendanceRequests', attendanceRequests); }, [attendanceRequests]);
  useEffect(() => { setLocalStorageItem('local_edumanage_parentAccounts', parentAccounts); }, [parentAccounts]);
  useEffect(() => { setLocalStorageItem('local_edumanage_classFees', classFeesData); }, [classFeesData]);
  useEffect(() => { setLocalStorageItem('local_edumanage_schoolConfigs', schoolConfigs); }, [schoolConfigs]);
  useEffect(() => { setLocalStorageItem('local_edumanage_backups', localBackups); }, [localBackups]);
  useEffect(() => { setLocalStorageItem('sch_currentUser', currentUser); }, [currentUser]);

  const isAdminPanel = currentUser?.role === 'MASTER_ADMIN' || currentUser?.role === 'master_admin';
  const effectiveSchoolId = currentUser?.schoolId || '';

  const defaultSchoolConfig = {
    activeAcademicSession: '2026-27',
    academicSessions: getLifetimeSessions(),
    allowedSessions: getLifetimeSessions()
  };

  const currentSchoolConfig = schoolConfigs[effectiveSchoolId] || defaultSchoolConfig;
  const activeAcademicSession = currentSchoolConfig.activeAcademicSession;
  const academicSessions = currentSchoolConfig.academicSessions;
  const allowedSessions = currentSchoolConfig.allowedSessions;

  const filteredUsers = isAdminPanel ? users : users.filter(u => u.schoolId === effectiveSchoolId);
  const rawSchoolStudents = isAdminPanel ? students : students.filter(s => !effectiveSchoolId || !s.schoolId || s.schoolId === effectiveSchoolId);
  const activeSchoolStudents = rawSchoolStudents.filter(s => !s.isDeleted);
  const deletedSchoolStudents = rawSchoolStudents.filter(s => s.isDeleted);
  
  const filteredStudents = activeSchoolStudents.map(s => {
    if (!s.academicSession || s.academicSession === activeAcademicSession) {
      return s;
    }
    const historyEntry = s.academicHistory?.find(h => h.academicSession === activeAcademicSession);
    if (historyEntry) {
      return {
        ...s,
        academicSession: activeAcademicSession,
        grade: historyEntry.grade,
        rollNo: historyEntry.rollNo,
        section: historyEntry.section || s.section
      };
    }
    return null;
  }).filter(Boolean) as Student[];

  const filteredTeachers = isAdminPanel ? teachers : teachers.filter(t => t.schoolId === effectiveSchoolId);
  const filteredHomeworks = isAdminPanel ? homeworks : homeworks.filter(h => h.schoolId === effectiveSchoolId);
  const studentIdsInSession = new Set(filteredStudents.map(s => s.id));
  
  const rawSchoolMarks = isAdminPanel ? marks : marks.filter(m => m.schoolId === effectiveSchoolId);
  const rawSchoolFeeRecords = isAdminPanel ? feeRecords : feeRecords.filter(f => f.schoolId === effectiveSchoolId);
  const filteredMarks = rawSchoolMarks.filter(m => studentIdsInSession.has(m.studentId));
  const filteredFeeRecords = rawSchoolFeeRecords.filter(f => studentIdsInSession.has(f.studentId));
  const filteredIssues = isAdminPanel ? issues : issues.filter(i => i.schoolId === effectiveSchoolId);
  const filteredParentAccounts = isAdminPanel ? parentAccounts : parentAccounts.filter(p => p.schoolId === effectiveSchoolId);

  const currentClassFees = classFeesData[effectiveSchoolId] || {};
  const allUsers = [...users, ...students, ...teachers, ...parentAccounts];

  const getStudentBalance = (studentId: string) => {
    const student = filteredStudents.find(s => s.id === studentId);
    const current = student ? (currentClassFees[student.grade] || 0) : 0;
    const previous = student?.previousDues || 0;
    const concession = student?.discountScholarship || 0;
    const total = Math.max(0, current + previous - concession);
    const paid = filteredFeeRecords.filter(f => f.studentId === studentId).reduce((acc, curr) => acc + curr.amount, 0);
    return { total, current, previous, concession, paid, balance: Math.max(0, total - paid) };
  };

  const updateStudent = (studentId: string, updates: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...updates } : s));
  };

  const setClassFee = (grade: string, amount: number) => {
    setClassFeesData(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...(prev[effectiveSchoolId] || {}),
        [grade]: amount
      }
    }));
  };

  const setClassFeesBatch = (grade: string, amount: number, halfYearly: number, yearly: number) => {
    setClassFeesData(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...(prev[effectiveSchoolId] || {}),
        [grade]: amount,
        [`${grade}_HalfYearly`]: halfYearly,
        [`${grade}_Yearly`]: yearly
      }
    }));
  };

  const saveSchoolConfig = (schoolId: string, config: { activeAcademicSession: string, academicSessions: string[], allowedSessions: string[] }) => {
    setSchoolConfigs(prev => ({ ...prev, [schoolId]: config }));
  };

  const saveSchoolFees = (schoolId: string, fees: Record<string, number>) => {
    setClassFeesData(prev => ({ ...prev, [schoolId]: fees }));
  };

  const login = (emailOrUsername: string, pass: string) => {
    const searchId = emailOrUsername.toLowerCase();
    const user = allUsers.find(u => {
      const emailMatch = u.email && u.email.toLowerCase() === searchId;
      const usernameMatch = (u as any).username && (u as any).username.toLowerCase() === searchId;
      const mobileMatch = (u as any).mobile && (u as any).mobile === searchId;
      const srFallbackMatch = (u as any).srNo && `stud_${(u as any).srNo}`.toLowerCase() === searchId;
      return (emailMatch || usernameMatch || mobileMatch || srFallbackMatch) && u.password === pass;
    });
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const googleUser = await signInWithGoogle();
      if (googleUser) {
        const userEmail = (googleUser.email || '').toLowerCase();
        // Check if user already exists
        const existing = allUsers.find(u => u.email?.toLowerCase() === userEmail);
        if (existing) {
          setCurrentUser(existing);
          return true;
        } else {
          // If logged in with zshankal6@gmail.com or new user, assign Master Admin
          const isMaster = userEmail === 'zshankal6@gmail.com' || userEmail.includes('shankal');
          const newAuthUser: User = {
            id: `u_${googleUser.uid}`,
            name: googleUser.displayName || 'Google Master Admin',
            role: isMaster ? 'MASTER_ADMIN' : 'ADMIN',
            email: googleUser.email || 'zshankal6@gmail.com',
          };
          setUsers(prev => [...prev, newAuthUser]);
          setCurrentUser(newAuthUser);
          return true;
        }
      }
    } catch (err) {
      console.error("Google login failed:", err);
      throw err;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    logoutFirebase();
  };

  const addSchool = (payload: any) => {
    const newSchoolId = `sch${Date.now()}`;
    const newSchool: School = {
      id: newSchoolId,
      name: payload.name,
      address: payload.address,
      mobile: payload.mobile,
      altMobile: payload.altMobile,
      udiseCode: payload.udiseCode,
      email: payload.adminEmail,
      logo: payload.logo || '',
      createdAt: new Date().toISOString(),
      features: ['registration', 'fees', 'homework', 'attendance', 'marks', 'tc', 'idcard']
    };
    setSchools(prev => [...prev, newSchool]);

    const newAdmin: User = {
      id: `a${Date.now()}`,
      name: 'School Admin',
      role: 'ADMIN',
      email: payload.adminEmail,
      password: payload.adminPass,
      schoolId: newSchoolId
    };
    setUsers(prev => [...prev, newAdmin]);

    setClassFeesData(prev => ({ ...prev, [newSchoolId]: {} }));
    setSchoolConfigs(prev => ({
      ...prev,
      [newSchoolId]: {
        activeAcademicSession: '2026-27',
        academicSessions: getLifetimeSessions(),
        allowedSessions: getLifetimeSessions()
      }
    }));
  };

  const updateSchool = (id: string, updates: Partial<School> & { adminPass?: string }) => {
    const { adminPass, ...schoolUpdates } = updates;
    setSchools(prev => prev.map(s => s.id === id ? { ...s, ...schoolUpdates } : s));

    if (schoolUpdates.email || adminPass) {
      setUsers(prev => prev.map(u => {
        if (u.schoolId === id && u.role === 'ADMIN') {
          return {
            ...u,
            email: schoolUpdates.email || u.email,
            password: adminPass || u.password
          };
        }
        return u;
      }));
    }
  };

  const updateSchoolFeatures = (id: string, features: string[]) => {
    setSchools(prev => prev.map(s => s.id === id ? { ...s, features } : s));
  };

  const deleteSchool = (id: string) => {
    setSchools(prev => prev.filter(s => s.id !== id));
    setUsers(prev => prev.filter(u => u.schoolId !== id));
    setStudents(prev => prev.filter(s => s.schoolId !== id));
    setTeachers(prev => prev.filter(t => t.schoolId !== id));
    setHomeworks(prev => prev.filter(h => h.schoolId !== id));
    setMarks(prev => prev.filter(m => m.schoolId !== id));
    setFeeRecords(prev => prev.filter(f => f.schoolId !== id));
    setAttendances(prev => prev.filter(a => a.schoolId !== id));
    setParentAccounts(prev => prev.filter(p => p.schoolId !== id));
    setClassFeesData(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setSchoolConfigs(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const addStudent = (student: Student) => {
    const targetSchoolId = student.schoolId || effectiveSchoolId;
    setStudents(prev => [...prev.filter(s => s.id !== student.id), { ...student, schoolId: targetSchoolId }]);
  };

  const importStudents = (newStudents: Student[]) => {
    const targetSchoolId = effectiveSchoolId || currentUser?.schoolId || '';
    const studentsWithMeta = newStudents.map(s => ({
      ...s,
      schoolId: s.schoolId || targetSchoolId,
      academicSession: s.academicSession || activeAcademicSession || '2026-27',
      isDeleted: false
    }));

    setStudents(prev => {
      const studentMap = new Map<string, Student>();
      prev.forEach(s => studentMap.set(s.id, s));
      studentsWithMeta.forEach(ns => {
        const existing = studentMap.get(ns.id);
        studentMap.set(ns.id, existing ? { ...existing, ...ns } : ns);
      });
      return Array.from(studentMap.values());
    });
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setMarks(prev => prev.filter(m => m.studentId !== id));
    setFeeRecords(prev => prev.filter(f => f.studentId !== id));
    setAttendances(prev => prev.filter(a => a.studentId !== id && a.userId !== id));
    setParentAccounts(prev => prev.filter(p => p.studentId !== id));
  };

  const restoreStudent = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isDeleted: false } : s));
  };

  const hardDeleteStudent = (id: string) => {
    deleteStudent(id);
  };

  const deleteAllStudentsInSchool = async (schoolId: string) => {
    const studentsToDelete = students.filter(s => s.schoolId === schoolId);
    const studentIds = new Set(studentsToDelete.map(s => s.id));

    setStudents(prev => prev.filter(s => s.schoolId !== schoolId));
    setMarks(prev => prev.filter(m => !studentIds.has(m.studentId)));
    setFeeRecords(prev => prev.filter(f => !studentIds.has(f.studentId)));
    setAttendances(prev => prev.filter(a => !(a.studentId && studentIds.has(a.studentId))));
    setParentAccounts(prev => prev.filter(p => !studentIds.has(p.studentId)));
  };

  const addTeacher = (teacher: Teacher) => {
    const targetSchoolId = teacher.schoolId || effectiveSchoolId;
    setTeachers(prev => [...prev.filter(t => t.id !== teacher.id), { ...teacher, schoolId: targetSchoolId }]);
  };

  const deleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
  };

  const addClerk = (clerk: User) => {
    const targetSchoolId = clerk.schoolId || effectiveSchoolId;
    setUsers(prev => [...prev.filter(u => u.id !== clerk.id), { ...clerk, schoolId: targetSchoolId }]);
  };

  const deleteClerk = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const addParentAccount = (parent: ParentAccount) => {
    const targetSchoolId = parent.schoolId || effectiveSchoolId;
    setParentAccounts(prev => [...prev.filter(p => p.id !== parent.id), { ...parent, schoolId: targetSchoolId }]);
  };

  const updateParentAccount = (id: string, updates: Partial<ParentAccount>) => {
    setParentAccounts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteParentAccount = (id: string) => {
    setParentAccounts(prev => prev.filter(p => p.id !== id));
  };

  const addHomework = (hw: Omit<Homework, 'id' | 'date' | 'schoolId'>) => {
    const id = `hw${Date.now()}`;
    const newHw: Homework = {
      ...hw,
      id,
      schoolId: effectiveSchoolId,
      date: new Date().toISOString()
    };
    setHomeworks(prev => [newHw, ...prev]);
  };

  const addMark = (mark: Omit<ExamMark, 'id' | 'date' | 'schoolId'>) => {
    const normSubject = normalizeSubject(mark.subject);
    const existing = marks.find(m => 
      m.studentId === mark.studentId && 
      m.examType === mark.examType && 
      isSameSubject(m.subject, mark.subject)
    );
    const id = existing ? existing.id : `m_${Date.now()}_${Math.random().toString().slice(2, 6)}`;
    const savedMark: ExamMark = {
      ...mark,
      subject: normSubject,
      id,
      schoolId: effectiveSchoolId,
      date: new Date().toISOString()
    };

    setMarks(prev => {
      const filtered = prev.filter(m => m.id !== id && !(m.studentId === mark.studentId && m.examType === mark.examType && isSameSubject(m.subject, mark.subject)));
      return [...filtered, savedMark];
    });
  };

  const importMarks = (newMarks: Omit<ExamMark, 'id' | 'date' | 'schoolId'>[]) => {
    const targetSchoolId = effectiveSchoolId || currentUser?.schoolId || '';
    const currentMarksMap = new Map<string, ExamMark>();
    marks.forEach(m => {
      const key = `${m.studentId}:::${m.examType}:::${normalizeSubject(m.subject).toLowerCase()}`;
      currentMarksMap.set(key, m);
    });

    newMarks.forEach((m, idx) => {
      const normSub = normalizeSubject(m.subject);
      const key = `${m.studentId}:::${m.examType}:::${normSub.toLowerCase()}`;
      const existing = currentMarksMap.get(key);
      const id = existing ? existing.id : `m_${Date.now()}_${idx}_${Math.random().toString().slice(2, 6)}`;
      const markObj: ExamMark = {
        ...m,
        subject: normSub,
        id,
        schoolId: targetSchoolId,
        date: new Date().toISOString()
      };
      currentMarksMap.set(key, markObj);
    });

    setMarks(Array.from(currentMarksMap.values()));
  };

  const addFeePayment = (studentId: string, amount: number, month: string, remarks: string, receiptNo?: string) => {
    const school = schools.find(s => s.id === effectiveSchoolId);
    const startingNo = school?.nextReceiptNo !== undefined ? school.nextReceiptNo : 1001;
    const finalReceiptNo = receiptNo || String(startingNo);
    
    const id = `fee${Date.now()}`;
    const record: FeeRecord = {
      id,
      receiptNo: finalReceiptNo,
      schoolId: effectiveSchoolId,
      studentId,
      amount,
      date: new Date().toISOString(),
      type: 'Payment',
      remarks: month ? `${month} Fee - ${remarks}` : remarks
    };

    setFeeRecords(prev => [record, ...prev]);

    if (school) {
      if (receiptNo) {
        const num = parseInt(receiptNo, 10);
        if (!isNaN(num)) {
          updateSchool(school.id, { nextReceiptNo: num + 1 });
        }
      } else {
        updateSchool(school.id, { nextReceiptNo: startingNo + 1 });
      }
    }
    return record;
  };

  const importFeeRecords = (records: FeeRecord[]) => {
    const targetSchoolId = effectiveSchoolId || currentUser?.schoolId || '';
    const recordsWithSchool = records.map(r => ({ ...r, schoolId: r.schoolId || targetSchoolId }));
    setFeeRecords(prev => {
      const map = new Map<string, FeeRecord>();
      prev.forEach(f => map.set(f.id, f));
      recordsWithSchool.forEach(f => map.set(f.id, f));
      return Array.from(map.values());
    });
  };

  const deleteFeePayment = (id: string) => {
    setFeeRecords(prev => prev.filter(f => f.id !== id));
  };

  const addIssue = (description: string) => {
    if (!currentUser) return;
    const id = `iss${Date.now()}`;
    const issue: Issue = {
      id,
      schoolId: effectiveSchoolId,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      fromUserRole: currentUser.role,
      description,
      status: 'Open',
      date: new Date().toISOString()
    };
    setIssues(prev => [issue, ...prev]);
  };

  const resolveIssue = (issueId: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'Resolved' } : i));
  };

  const setActiveAcademicSession = (session: string) => {
    const config = schoolConfigs[effectiveSchoolId] || defaultSchoolConfig;
    setSchoolConfigs(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...config,
        activeAcademicSession: session
      }
    }));
  };

  const addAcademicSession = (session: string) => {
    const config = schoolConfigs[effectiveSchoolId] || defaultSchoolConfig;
    const updated = Array.from(new Set([...config.academicSessions, session]));
    setSchoolConfigs(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...config,
        academicSessions: updated
      }
    }));
  };

  const editAcademicSession = (oldSession: string, newSession: string) => {
    const config = schoolConfigs[effectiveSchoolId] || defaultSchoolConfig;
    const updated = config.academicSessions.map(s => s === oldSession ? newSession : s);
    const updatedAllowed = config.allowedSessions.map(s => s === oldSession ? newSession : s);
    let active = config.activeAcademicSession;
    if (active === oldSession) active = newSession;
    setSchoolConfigs(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...config,
        activeAcademicSession: active,
        academicSessions: updated,
        allowedSessions: updatedAllowed
      }
    }));
  };

  const deleteAcademicSession = (session: string) => {
    const config = schoolConfigs[effectiveSchoolId] || defaultSchoolConfig;
    const updated = config.academicSessions.filter(s => s !== session);
    const updatedAllowed = config.allowedSessions.filter(s => s !== session);
    let active = config.activeAcademicSession;
    if (active === session) active = updated[0] || '2026-27';
    setSchoolConfigs(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...config,
        activeAcademicSession: active,
        academicSessions: updated,
        allowedSessions: updatedAllowed
      }
    }));
  };

  const setAllowedSessions = (sessions: string[]) => {
    const config = schoolConfigs[effectiveSchoolId] || defaultSchoolConfig;
    setSchoolConfigs(prev => ({
      ...prev,
      [effectiveSchoolId]: {
        ...config,
        allowedSessions: sessions
      }
    }));
  };

  const saveAttendance = async (records: AttendanceRecord[]) => {
    setAttendances(prev => {
      const map = new Map<string, AttendanceRecord>();
      prev.forEach(a => map.set(a.id, a));
      records.forEach(rec => {
        const targetId = rec.userId || rec.studentId || `unknown_${Date.now()}`;
        const id = rec.id || `${targetId}_${rec.date}`;
        map.set(id, { ...rec, id, schoolId: rec.schoolId || effectiveSchoolId });
      });
      return Array.from(map.values());
    });
  };

  const addNotificationLog = async (log: Omit<NotificationLog, 'id' | 'schoolId' | 'timestamp'>) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newLog: NotificationLog = {
      ...log,
      id,
      schoolId: effectiveSchoolId,
      timestamp: new Date().toISOString()
    };
    setNotificationLogs(prev => [newLog, ...prev]);
  };

  const requestSessionApproval = async (session: string) => {
    if (!currentUser || !effectiveSchoolId) return;
    const school = schools.find(s => s.id === effectiveSchoolId);
    const id = `${effectiveSchoolId}_${session.replace(/[\s/]+/g, '_')}`;
    const req: SessionRequest = {
      id,
      schoolId: effectiveSchoolId,
      schoolName: school ? school.name : 'Unknown School',
      session,
      status: 'Pending',
      requestedAt: new Date().toISOString(),
      requestedByEmail: currentUser.email
    };
    setSessionRequests(prev => [req, ...prev.filter(r => r.id !== id)]);
  };

  const approveSessionRequest = async (requestId: string) => {
    const target = sessionRequests.find(r => r.id === requestId);
    if (!target) return;

    setSessionRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Approved' } : r));

    const config = schoolConfigs[target.schoolId] || defaultSchoolConfig;
    const updatedAllowed = Array.from(new Set([...config.allowedSessions, target.session]));
    const updatedAcademic = Array.from(new Set([...config.academicSessions, target.session]));

    setSchoolConfigs(prev => ({
      ...prev,
      [target.schoolId]: {
        ...config,
        academicSessions: updatedAcademic,
        allowedSessions: updatedAllowed
      }
    }));
  };

  const deleteSessionRequest = async (requestId: string) => {
    setSessionRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const submitAttendanceRequest = async (reqPayload: Omit<AttendanceRequest, 'id' | 'schoolId' | 'status' | 'requestedAt'>) => {
    const id = `att_req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const req: AttendanceRequest = {
      ...reqPayload,
      id,
      schoolId: effectiveSchoolId,
      status: 'Pending',
      requestedAt: new Date().toISOString()
    };
    setAttendanceRequests(prev => [req, ...prev]);
  };

  const approveAttendanceRequest = async (requestId: string) => {
    const reqData = attendanceRequests.find(r => r.id === requestId);
    if (!reqData) return;

    setAttendanceRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Approved' } : r));

    const targetId = reqData.userId || `unknown_${Date.now()}`;
    const attId = `${targetId}_${reqData.date}`;
    const attRecord: AttendanceRecord = {
      id: attId,
      schoolId: reqData.schoolId,
      userId: reqData.userId,
      userType: reqData.userRole,
      date: reqData.date,
      status: reqData.requestedStatus
    };
    setAttendances(prev => [...prev.filter(a => a.id !== attId), attRecord]);
  };

  const rejectAttendanceRequest = async (requestId: string) => {
    setAttendanceRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Rejected' } : r));
  };

  // Local Offline Snapshot & Disk Backup functions
  const createLocalBackupSnapshot = (schoolId: string): LocalBackupSnapshot => {
    const schoolObj = schools.find(s => s.id === schoolId);
    const schoolName = schoolObj?.name || 'Selected School';
    const targetStudents = students.filter(s => s.schoolId === schoolId);
    const targetMarks = marks.filter(m => m.schoolId === schoolId);
    const targetAttendances = attendances.filter(a => a.schoolId === schoolId);
    const targetFeeRecords = feeRecords.filter(f => f.schoolId === schoolId);

    const backupId = `local_snap_${Date.now()}`;
    const backupPackage = {
      type: "school_full_backup",
      schoolId,
      schoolName,
      exportedAt: new Date().toISOString(),
      students: targetStudents,
      marks: targetMarks,
      attendances: targetAttendances,
      feeRecords: targetFeeRecords,
      config: schoolConfigs[schoolId],
      classFees: classFeesData[schoolId]
    };

    const snapStr = JSON.stringify(backupPackage);
    const sizeKB = (snapStr.length / 1024).toFixed(1);

    const snapshotItem: LocalBackupSnapshot = {
      id: backupId,
      schoolId,
      schoolName,
      exportedAt: backupPackage.exportedAt,
      studentsCount: targetStudents.length,
      marksCount: targetMarks.length,
      attendancesCount: targetAttendances.length,
      feeRecordsCount: targetFeeRecords.length,
      size: `${sizeKB} KB`,
      snapshot: snapStr
    };

    setLocalBackups(prev => [snapshotItem, ...prev]);
    return snapshotItem;
  };

  const restoreFromLocalBackupSnapshot = (snapshotId: string, rawSnapshotStr?: string): number => {
    let snapshotData: any = null;
    if (rawSnapshotStr) {
      snapshotData = JSON.parse(rawSnapshotStr);
    } else {
      const found = localBackups.find(b => b.id === snapshotId);
      if (!found) throw new Error("Local snapshot not found in local storage.");
      snapshotData = JSON.parse(found.snapshot);
    }

    if (!snapshotData || snapshotData.type !== "school_full_backup") {
      throw new Error("Invalid snapshot format.");
    }

    const targetSchoolId = snapshotData.schoolId || effectiveSchoolId;
    let count = 0;

    if (Array.isArray(snapshotData.students)) {
      setStudents(prev => {
        const others = prev.filter(s => s.schoolId !== targetSchoolId);
        const restored = snapshotData.students.map((s: Student) => ({ ...s, schoolId: targetSchoolId }));
        count += restored.length;
        return [...others, ...restored];
      });
    }

    if (Array.isArray(snapshotData.marks)) {
      setMarks(prev => {
        const others = prev.filter(m => m.schoolId !== targetSchoolId);
        const restored = snapshotData.marks.map((m: ExamMark) => ({ ...m, schoolId: targetSchoolId }));
        count += restored.length;
        return [...others, ...restored];
      });
    }

    if (Array.isArray(snapshotData.attendances)) {
      setAttendances(prev => {
        const others = prev.filter(a => a.schoolId !== targetSchoolId);
        const restored = snapshotData.attendances.map((a: AttendanceRecord) => ({ ...a, schoolId: targetSchoolId }));
        count += restored.length;
        return [...others, ...restored];
      });
    }

    if (Array.isArray(snapshotData.feeRecords)) {
      setFeeRecords(prev => {
        const others = prev.filter(f => f.schoolId !== targetSchoolId);
        const restored = snapshotData.feeRecords.map((f: FeeRecord) => ({ ...f, schoolId: targetSchoolId }));
        count += restored.length;
        return [...others, ...restored];
      });
    }

    if (snapshotData.config) {
      setSchoolConfigs(prev => ({ ...prev, [targetSchoolId]: snapshotData.config }));
    }

    if (snapshotData.classFees) {
      setClassFeesData(prev => ({ ...prev, [targetSchoolId]: snapshotData.classFees }));
    }

    return count;
  };

  // Full Disk Export: Saves all data into a JSON file for saving to E: drive / local disk
  const exportFullDiskBackup = () => {
    const fullBackup = {
      system: "EduManage-ERP-Offline",
      exportedAt: new Date().toISOString(),
      schools,
      users,
      students,
      teachers,
      homeworks,
      marks,
      feeRecords,
      issues,
      attendances,
      notificationLogs,
      sessionRequests,
      attendanceRequests,
      parentAccounts,
      classFeesData,
      schoolConfigs,
      localBackups
    };

    const jsonStr = JSON.stringify(fullBackup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `EduManage_Full_Local_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Full Disk Import: Restores complete offline database from local JSON file
  const importFullDiskBackup = (jsonContent: string): boolean => {
    try {
      const data = JSON.parse(jsonContent);
      if (data.schools && Array.isArray(data.schools)) setSchools(data.schools);
      if (data.users && Array.isArray(data.users)) setUsers(data.users);
      if (data.students && Array.isArray(data.students)) setStudents(data.students);
      if (data.teachers && Array.isArray(data.teachers)) setTeachers(data.teachers);
      if (data.homeworks && Array.isArray(data.homeworks)) setHomeworks(data.homeworks);
      if (data.marks && Array.isArray(data.marks)) setMarks(data.marks);
      if (data.feeRecords && Array.isArray(data.feeRecords)) setFeeRecords(data.feeRecords);
      if (data.issues && Array.isArray(data.issues)) setIssues(data.issues);
      if (data.attendances && Array.isArray(data.attendances)) setAttendances(data.attendances);
      if (data.notificationLogs && Array.isArray(data.notificationLogs)) setNotificationLogs(data.notificationLogs);
      if (data.sessionRequests && Array.isArray(data.sessionRequests)) setSessionRequests(data.sessionRequests);
      if (data.attendanceRequests && Array.isArray(data.attendanceRequests)) setAttendanceRequests(data.attendanceRequests);
      if (data.parentAccounts && Array.isArray(data.parentAccounts)) setParentAccounts(data.parentAccounts);
      if (data.classFeesData) setClassFeesData(data.classFeesData);
      if (data.schoolConfigs) setSchoolConfigs(data.schoolConfigs);
      if (data.localBackups && Array.isArray(data.localBackups)) setLocalBackups(data.localBackups);
      return true;
    } catch (err) {
      console.error("Failed to parse disk backup JSON:", err);
      return false;
    }
  };

  return (
    <StoreContext.Provider value={{
      schools, users: filteredUsers, students: filteredStudents, allStudents: rawSchoolStudents, deletedStudents: deletedSchoolStudents, teachers: filteredTeachers, 
      homeworks: filteredHomeworks, marks: filteredMarks, allMarks: rawSchoolMarks, feeRecords: filteredFeeRecords, allFeeRecords: rawSchoolFeeRecords, 
      issues: filteredIssues, attendances, notificationLogs, currentUser, classFees: currentClassFees, activeAcademicSession, academicSessions, allowedSessions,
      sessionRequests, attendanceRequests, parentAccounts: filteredParentAccounts, localBackups,
      login, logout, setActiveAcademicSession, addAcademicSession, editAcademicSession, deleteAcademicSession, setAllowedSessions, addSchool, updateSchool, updateSchoolFeatures, deleteSchool, addStudent, importStudents, deleteStudent, restoreStudent, hardDeleteStudent, deleteAllStudentsInSchool, updateStudent, addTeacher, 
      deleteTeacher, addClerk, deleteClerk, addParentAccount, updateParentAccount, deleteParentAccount, addHomework, addMark, importMarks, addFeePayment, importFeeRecords, deleteFeePayment, 
      addIssue, resolveIssue, setClassFee, setClassFeesBatch, getStudentBalance, saveAttendance, addNotificationLog,
      requestSessionApproval, approveSessionRequest, deleteSessionRequest,
      submitAttendanceRequest, approveAttendanceRequest, rejectAttendanceRequest,
      createLocalBackupSnapshot, restoreFromLocalBackupSnapshot, exportFullDiskBackup, importFullDiskBackup,
      schoolConfigs, classFeesData, saveSchoolConfig, saveSchoolFees,
      loginWithGoogle, isCloudSynced
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
