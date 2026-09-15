import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("swathi.p@emergent.sh");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      nav("/", { replace: true });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFBFD]">
      {/* Left brand pane */}
      <div className="hidden lg:flex relative overflow-hidden bg-indigo-600 text-white p-14 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center font-bold">
              P
            </div>
            <div className="text-lg font-semibold tracking-tight">ProjectHub</div>
          </div>
        </div>
        <div className="space-y-5 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            One clean workspace for every project you own.
          </h1>
          <p className="text-indigo-100/90 text-base leading-relaxed">
            Track projects, tasks, teammates, files and analytics — with Slack alerts baked in.
            Notion-clean, Linear-fast.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2 text-sm">
            {["Kanban", "Analytics", "Slack"].map((t) => (
              <div key={t} className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-indigo-200/80">© {new Date().getFullYear()} ProjectHub</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 border-slate-200 shadow-sm">
          <div className="mb-6">
            <div className="text-2xl font-semibold tracking-tight">Sign in</div>
            <p className="text-sm text-slate-500 mt-1">
              Manager access to your ProjectHub workspace.
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div data-testid="login-error" className="text-sm text-red-600">
                {error}
              </div>
            )}
            <Button
              type="submit"
              data-testid="login-submit-button"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
            <KeyRound className="w-4 h-4 mt-0.5 text-indigo-600" />
            <div>
              <div className="font-medium text-slate-800">Demo credentials</div>
              <div className="mono">swathi.p@emergent.sh / admin123</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
