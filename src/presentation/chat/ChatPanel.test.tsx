import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "./ChatPanel";
import type { ChatMessage } from "./ChatPanel";

const MESSAGES: ChatMessage[] = [
  { id: "1", role: "user", text: "Swap the vanity for something cheaper" },
  { id: "2", role: "assistant", text: "Swapped to the Poplin vanity — $200 less, still matches your theme." },
];

describe("ChatPanel", () => {
  it("shows an empty-state placeholder when there are no messages yet", () => {
    render(<ChatPanel messages={[]} onSend={() => {}} />);
    expect(screen.getByText(/Ask me to swap a fixture/)).toBeInTheDocument();
  });

  it("renders each message with a role-based class distinguishing user from assistant", () => {
    const { container } = render(<ChatPanel messages={MESSAGES} onSend={() => {}} />);
    const rendered = container.querySelectorAll(".chat-message");
    expect(rendered).toHaveLength(2);
    expect(rendered[0].classList.contains("chat-message-user")).toBe(true);
    expect(rendered[1].classList.contains("chat-message-assistant")).toBe(true);
    expect(screen.getByText("Swap the vanity for something cheaper")).toBeInTheDocument();
  });

  it("does not show the empty-state placeholder once there are messages", () => {
    render(<ChatPanel messages={MESSAGES} onSend={() => {}} />);
    expect(screen.queryByText(/Ask me to swap a fixture/)).not.toBeInTheDocument();
  });

  it("calls onSend with the trimmed text when the Send button is clicked, then clears the input", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByLabelText("Message");
    await user.type(input, "  make it cheaper  ");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("make it cheaper");
    expect(input).toHaveValue("");
  });

  it("also sends on pressing Enter in the input", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByLabelText("Message");
    await user.type(input, "explain the toilet pick{Enter}");
    expect(onSend).toHaveBeenCalledWith("explain the toilet pick");
  });

  it("keeps Send disabled, and never calls onSend, for empty or whitespace-only input", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();

    const input = screen.getByLabelText("Message");
    await user.type(input, "   ");
    expect(sendButton).toBeDisabled();
    await user.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });
});
