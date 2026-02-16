export type StreamJsonHandler = (payload: unknown) => Promise<void> | void;

export interface StreamTransport {
  streamJson(input: {
    url: string;
    init?: RequestInit;
    signal?: AbortSignal;
    onMessage: StreamJsonHandler;
  }): Promise<void>;
}
