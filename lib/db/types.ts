import type {
  ActivityLog as PrismaActivityLog,
  Invitation as PrismaInvitation,
  Team as PrismaTeam,
  TeamMember as PrismaTeamMember,
  User as PrismaUser
} from '@prisma/client';

export type User = PrismaUser;
export type Team = PrismaTeam;
export type TeamMember = PrismaTeamMember;
export type Invitation = PrismaInvitation;
export type ActivityLog = PrismaActivityLog;

export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION'
}

