export function successResponse<T>(data: T, meta?: Record<string, any>) {
  return { data, meta };
}

export function errorResponse(error: string, code: string = 'INTERNAL_ERROR') {
  return { error, code };
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleError = (err: unknown) => {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: errorResponse(err.message, err.code),
    };
  }

  if (err instanceof Error) {
    console.error('Unhandled error:', err.message);
    return {
      status: 500,
      body: errorResponse('Internal server error', 'INTERNAL_ERROR'),
    };
  }

  console.error('Unknown error:', err);
  return {
    status: 500,
    body: errorResponse('Internal server error', 'INTERNAL_ERROR'),
  };
};
