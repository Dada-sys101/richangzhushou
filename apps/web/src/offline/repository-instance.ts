import type { LocalRepository } from "./repository";
import { V1PlainRepository } from "./v1-plain-repository";

export const defaultRepository: LocalRepository = new V1PlainRepository();
