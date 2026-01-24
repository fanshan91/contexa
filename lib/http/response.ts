import { ApiError, ApiErrorCode, ApiResponse } from './api-response';

export function jsonOk<T>(
  data: T,
  init?: Omit<ResponseInit, 'status'> & { status?: number }
) {
  return Response.json(
    {
      ok: true,
      data
    } satisfies ApiResponse<T>,
    {
      status: init?.status ?? 200,
      headers: init?.headers
    }
  );
}

export function jsonError(
  error: ApiError,
  init?: Omit<ResponseInit, 'status'> & { status?: number }
) {
  return Response.json(
    {
      ok: false,
      error
    } satisfies ApiResponse<never>,
    {
      status: init?.status ?? 400,
      headers: init?.headers
    }
  );
}

export function internalError(message = 'Internal server error') {
  return jsonError(
    {
      code: 'INTERNAL_ERROR',
      message
    },
    { status: 500 }
  );
}

export function notFound(message = 'Not found') {
  return jsonError(
    {
      code: 'NOT_FOUND',
      message
    },
    { status: 404 }
  );
}

export function unauthorized(message = 'Unauthorized') {
  return jsonError(
    {
      code: 'UNAUTHORIZED',
      message
    },
    { status: 401 }
  );
}

export function validationError(
  message = 'Validation error',
  fieldErrors?: ApiError['fieldErrors']
) {
  return jsonError(
    {
      code: 'VALIDATION_ERROR',
      message,
      fieldErrors
    },
    { status: 400 }
  );
}

export function fromUnknownError(err: unknown) {
  if (err instanceof Error) {
    return internalError(err.message);
  }
  return internalError();
}

export function isApiErrorCode(value: string): value is ApiErrorCode {
  return (
    value === 'VALIDATION_ERROR' ||
    value === 'UNAUTHORIZED' ||
    value === 'FORBIDDEN' ||
    value === 'NOT_FOUND' ||
    value === 'INTERNAL_ERROR'
  );
}

