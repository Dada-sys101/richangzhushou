declare module "ali-oss" {
  interface Options {
    accessKeyId: string;
    accessKeySecret: string;
    bucket?: string;
    endpoint?: string;
    region?: string;
    secure?: boolean;
  }

  interface PutObjectOptions {
    headers?: Record<string, string>;
    mime?: string;
  }

  interface GetObjectResult {
    content: Buffer | string;
  }

  class OSS {
    constructor(options: Options);

    delete(name: string): Promise<unknown>;

    get(name: string): Promise<GetObjectResult>;

    put(
      name: string,
      file: Buffer | string,
      options?: PutObjectOptions,
    ): Promise<unknown>;
  }

  export = OSS;
}
