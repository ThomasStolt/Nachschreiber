export interface Student {
  id: string;
  last_name: string;
  first_name: string;
  class_name: string;
}

export interface Entry {
  id: string;
  student_id: string;
  subject: string;
  duration_minutes: number;
  aids: string;
  teacher: string;
  room: 'A' | 'B' | 'C';
}

export interface EntryCreate {
  student_id: string;
  subject: string;
  duration_minutes: number;
  aids: string;
  teacher: string;
}

export interface SeatAssignment {
  desk: number;
  seat: number;
  entry: Entry;
  student: Student;
}

export interface RoomPlan {
  room: 'A' | 'B' | 'C';
  label: string;
  capacity: number;
  assignments: SeatAssignment[];
}

export interface SeatingPlan {
  room_a: RoomPlan;
  room_b: RoomPlan;
  room_c: RoomPlan;
}
