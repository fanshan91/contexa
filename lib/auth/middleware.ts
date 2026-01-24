import { z } from 'zod';
import { TeamDataWithMembers, User } from '@/lib/db/types';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getTranslations } from 'next-intl/server';

export type ActionState = {
  error?: string;
  success?: string;
  [key: string]: any; // This allows for additional properties
};

type ValidatedActionFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData
) => Promise<T>;

export function validatedAction<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      const t = await getTranslations();
      return { error: t(result.error.errors[0].message) };
    }

    return action(result.data, formData);
  };
}

type ValidatedActionWithUserFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData,
  user: User
) => Promise<T>;

export function validatedActionWithUser<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionWithUserFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    const user = await getUser();
    if (!user) {
      throw new Error('User is not authenticated');
    }

    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      const t = await getTranslations();
      return { error: t(result.error.errors[0].message) };
    }

    return action(result.data, formData, user);
  };
}

type ActionWithTeamFunction<T> = (
  formData: FormData,
  team: TeamDataWithMembers
) => Promise<T>;

export function withTeam<T>(action: ActionWithTeamFunction<T>) {
  return async (formData: FormData): Promise<T> => {
    const user = await getUser();
    if (!user) {
      redirect('/sign-in');
    }

    const team = await getTeamForUser();
    if (!team) {
      throw new Error('Team not found');
    }

    return action(formData, team);
  };
}

type ValidatedActionWithProjectFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData,
  user: User
) => Promise<T>;

export function validatedActionWithProject<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionWithProjectFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    const user = await getUser();
    if (!user) {
      throw new Error('User is not authenticated');
    }

    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      const t = await getTranslations();
      return { error: t(result.error.errors[0].message) };
    }

    const { projectId } = result.data as { projectId?: number };
    if (typeof projectId !== 'number') {
      return { error: 'projectId is required' };
    }

    if (!user.isSystemAdmin) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } }
      });
      if (!member) {
        return { error: '没有该项目的访问权限' };
      }
    }

    return action(result.data, formData, user);
  };
}
