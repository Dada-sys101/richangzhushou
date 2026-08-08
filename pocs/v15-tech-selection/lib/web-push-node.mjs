import webPushPackage from "web-push";
import {
  buildPushRequestInput,
  validateVapidConfig,
} from "./web-push-core.mjs";

const { generateRequestDetails, setVapidDetails } = webPushPackage;

export function createWebPushRequestFactory(vapidInput) {
  const vapid = validateVapidConfig(vapidInput);
  return async function createRequest({ subscription, payload, options }) {
    const input = buildPushRequestInput({ subscription, payload, options });
    setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    return generateRequestDetails(
      input.subscription,
      input.payload.json,
      input.options,
    );
  };
}
