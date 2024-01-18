export class FetchError extends Error {
  constructor(public response: Response) {
    super(response.statusText);
  }
}

export class MissingOptProviderError extends Error {
  constructor() {
    super(
      "Missing OptProvider. Did you forget to wrap your app in an OptProvider?",
    );
  }
}
