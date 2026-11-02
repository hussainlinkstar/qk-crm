"use client";

import { useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import type { ConversationChannel } from "@/lib/types";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";

export function openEmailDraft(email: string, subject: string, body: string) {
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openWhatsApp(phone: string, body: string) {
  const digits = phone.replace(/\D/g, "");
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
}

export default function ComposeMessageModal({
  channel,
  leadId,
  leadName,
  address,
  onClose,
  onSent,
}: {
  channel: ConversationChannel;
  leadId: string;
  leadName: string;
  address: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { toast } = useWorkspace();
  const email = channel === "email";
  const [to, setTo] = useState(address);
  const [subject, setSubject] = useState(email ? `Following up — ${leadName}` : "");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const destination = (email ? address : to).trim();
    if (!email && destination.replace(/\D/g, "").length < 8) {
      setError("Enter a WhatsApp number with the country code.");
      return;
    }
    if (email && subject.trim().length < 2) {
      setError("Add a subject.");
      return;
    }
    if (body.trim().length < 2) {
      setError("Write a short message.");
      return;
    }
    const text = body.trim();
    const title = email ? subject.trim() : null;
    crm.sendMessage(leadId, { channel, address: destination, subject: title, body: text });
    if (email) openEmailDraft(destination, title ?? "", text);
    else openWhatsApp(destination, text);
    toast(email ? "Email added to the conversation" : "WhatsApp added to the conversation");
    onSent?.();
    onClose();
  };

  return (
    <Modal
      kicker={email ? "Email" : "WhatsApp"}
      title={email ? "New email" : "New WhatsApp message"}
      description={email ? `Saved on ${leadName}'s conversation, then opened in your email app.` : `Saved on ${leadName}'s conversation, then opened in WhatsApp.`}
      onClose={onClose}
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="compose-form" icon={email ? "mail" : "whatsapp"}>{email ? "Send email" : "Send WhatsApp"}</Button>
        </>
      }
    >
      <form id="compose-form" className="form-grid" onSubmit={submit} noValidate>
        <label className="field">
          <span>{email ? "To" : "WhatsApp number"}</span>
          <input className="input" value={email ? address : to} readOnly={email} onChange={(event) => { setTo(event.target.value); setError(""); }} placeholder={email ? undefined : "+1 555 123 4567"} data-autofocus={email ? undefined : true} />
        </label>
        {email && (
          <label className="field">
            <span>Subject</span>
            <input className="input" value={subject} onChange={(event) => { setSubject(event.target.value); setError(""); }} data-autofocus />
          </label>
        )}
        <label className="field">
          <span>Message</span>
          <textarea className="textarea" rows={5} value={body} onChange={(event) => { setBody(event.target.value); setError(""); }} placeholder={email ? "Write the email…" : "Write the WhatsApp message…"} aria-invalid={Boolean(error)} />
          {error && <span className="field-error">{error}</span>}
        </label>
      </form>
    </Modal>
  );
}
