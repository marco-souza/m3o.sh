export class DataAccessError extends Error {
  status: 404 | 409 | 500 = 500;
}

export class SourceExistsError extends DataAccessError {
  status = 409 as const;

  constructor(message = "Source URL already exists") {
    super(message);
  }
}

export class InternalServerError extends DataAccessError {
  status = 500 as const;

  constructor(message = "Internal Server Error") {
    super(message);
  }
}

export class FeedNotFound extends DataAccessError {
  status = 404 as const;

  constructor(message = "Feed not found") {
    super(message);
  }
}
