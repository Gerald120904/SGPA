import {
  createIcons,
  User,
  LockKeyhole,
  Eye,
  EyeOff,
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BookOpen,
  Briefcase,
  DoorOpen,
  CalendarDays,
  LineChart,
  ClipboardList,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Construction
} from 'lucide';


export function renderizarIconos() {

  createIcons({

    icons: {

      User,
      LockKeyhole,
      Eye,
      EyeOff,

      LayoutDashboard,
      Users,
      GraduationCap,
      School,
      BookOpen,
      Briefcase,
      DoorOpen,
      CalendarDays,
      LineChart,
      ClipboardList,

      LogOut,
      ShieldCheck,
      ChevronRight,
      Construction

    }

  });

}