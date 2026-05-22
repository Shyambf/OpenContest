import { useEffect, useState } from "react";
import { Send, Radio } from "lucide-react";
import { api, type Clarification } from "../../api";

export function Clarifications() {
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [selectedClarification, setSelectedClarification] = useState<Clarification | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<"private" | "broadcast">("private");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .clarifications()
      .then((items) => {
        setClarifications(items);
        setSelectedClarification((selected) =>
          selected ? items.find((item) => item.id === selected.id) ?? selected : selected,
        );
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load clarifications"));
  }, []);

  const handleSendReply = async (mode = replyMode) => {
    if (!selectedClarification || !replyText.trim()) return;
    setMessage("Saving reply...");
    try {
      const updated = await api.replyClarification(selectedClarification.id, {
        reply: replyText,
        status: mode === "broadcast" ? "broadcast" : "replied",
      });
      setClarifications((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedClarification(updated);
      setReplyText("");
      setMessage(mode === "broadcast" ? "Announcement published." : "Reply saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reply failed");
    }
  };

  const closeMobileReply = () => {
    setReplyText("");
    setSelectedClarification(null);
  };

  const getStatusColor = (status: Clarification["status"]) => {
    switch (status) {
      case "pending":
        return "text-[#e2b714] border-[#e2b714]";
      case "replied":
        return "text-[#879f27] border-[#879f27]";
      case "broadcast":
        return "text-[#d1d0c5] border-[#d1d0c5]";
    }
  };

  const pendingCount = clarifications.filter((c) => c.status === "pending").length;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-[#e2b714]">Clarifications</h1>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-[#e2b714] text-[#323437] rounded">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-[#646669]">Manage participant questions and announcements</p>
        {message && <p className="text-[#646669] text-sm mt-2">{message}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-[#d1d0c5] mb-4">Inbox</h2>
          {clarifications.map((clarification) => (
            <div
              key={clarification.id}
              onClick={() => setSelectedClarification(clarification)}
              className={`border rounded p-4 cursor-pointer transition-colors ${
                selectedClarification?.id === clarification.id
                  ? "border-[#e2b714] bg-[#2c2e31]"
                  : "border-[#646669] hover:border-[#e2b714]"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-[#d1d0c5] text-sm mb-1">
                    {clarification.user} / {clarification.problemLabel || "General"}
                  </div>
                  <div className="text-xs text-[#646669]">{clarification.contestTitle}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 text-xs border rounded ${getStatusColor(clarification.status)}`}>
                    {clarification.status}
                  </span>
                  <span className="text-xs text-[#646669]">{new Date(clarification.submittedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-sm text-[#d1d0c5] line-clamp-2">{clarification.question}</div>
            </div>
          ))}
          {clarifications.length === 0 && (
            <div className="border border-[#646669] rounded p-6 text-[#646669]">No clarifications yet.</div>
          )}
        </div>

        <ReplyPanel
          selectedClarification={selectedClarification}
          replyText={replyText}
          setReplyText={setReplyText}
          replyMode={replyMode}
          setReplyMode={setReplyMode}
          handleSendReply={handleSendReply}
          getStatusColor={getStatusColor}
          className="hidden lg:block"
        />
      </div>

      {selectedClarification && (
        <div className="lg:hidden fixed inset-0 top-[61px] bg-[#323437] z-50 overflow-y-auto">
          <div className="p-6">
            <button onClick={closeMobileReply} className="text-[#646669] hover:text-[#e2b714] text-sm mb-6">
              Back to Inbox
            </button>
            <ReplyPanel
              selectedClarification={selectedClarification}
              replyText={replyText}
              setReplyText={setReplyText}
              replyMode={replyMode}
              setReplyMode={setReplyMode}
              handleSendReply={handleSendReply}
              getStatusColor={getStatusColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyPanel({
  selectedClarification,
  replyText,
  setReplyText,
  replyMode,
  setReplyMode,
  handleSendReply,
  className = "",
}: {
  selectedClarification: Clarification | null;
  replyText: string;
  setReplyText: (value: string) => void;
  replyMode: "private" | "broadcast";
  setReplyMode: (value: "private" | "broadcast") => void;
  handleSendReply: (mode?: "private" | "broadcast") => void;
  getStatusColor: (status: Clarification["status"]) => string;
  className?: string;
}) {
  return (
    <div className={`border border-[#646669] rounded overflow-hidden lg:sticky lg:top-20 lg:self-start ${className}`}>
      {selectedClarification ? (
        <>
          <div className="px-6 py-4 border-b border-[#646669] bg-[#2c2e31]">
            <div className="text-[#d1d0c5] mb-1">
              {selectedClarification.user} / {selectedClarification.problemLabel || "General"}
            </div>
            <div className="text-xs text-[#646669]">{selectedClarification.contestTitle}</div>
          </div>

          <div className="p-6 border-b border-[#646669]">
            <div className="text-xs text-[#646669] mb-2">Question:</div>
            <div className="text-[#d1d0c5] leading-relaxed">{selectedClarification.question}</div>
          </div>

          {selectedClarification.reply && (
            <div className="p-6 border-b border-[#646669] bg-[#2c2e31]">
              <div className="text-xs text-[#646669] mb-2">
                {selectedClarification.status === "broadcast" ? "Broadcast:" : "Reply:"}
              </div>
              <div className="text-[#879f27] leading-relaxed">{selectedClarification.reply}</div>
            </div>
          )}

          {selectedClarification.status === "pending" && (
            <div className="p-6">
              <label className="block text-[#646669] text-sm mb-2">
                <span className="text-[#e2b714]">{">"}</span> reply
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full h-32 bg-[#2c2e31] border border-[#646669] rounded p-3 text-[#d1d0c5] text-sm focus:outline-none focus:border-[#e2b714] resize-none mb-4"
              />
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setReplyMode("private")}
                  className={`flex-1 px-4 py-2 border rounded transition-colors text-sm ${
                    replyMode === "private"
                      ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                      : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
                  }`}
                >
                  Reply Privately
                </button>
                <button
                  onClick={() => setReplyMode("broadcast")}
                  className={`flex-1 px-4 py-2 border rounded transition-colors text-sm flex items-center justify-center gap-2 ${
                    replyMode === "broadcast"
                      ? "bg-[#e2b714] text-[#323437] border-[#e2b714]"
                      : "border-[#646669] text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714]"
                  }`}
                >
                  <Radio size={14} />
                  Broadcast
                </button>
              </div>
              <button
                onClick={() => handleSendReply(replyMode)}
                disabled={!replyText.trim()}
                className="w-full px-6 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {replyMode === "broadcast" ? "Broadcast Reply" : "Send Reply"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="p-12 text-center text-[#646669]">Select a clarification to respond</div>
      )}
    </div>
  );
}
