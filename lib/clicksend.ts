export async function sendGateCombinationSms({ phone, message }: { phone: string; message: string }) {
  console.log("ClickSend placeholder", { phone, message });
  return { ok: true };
}
