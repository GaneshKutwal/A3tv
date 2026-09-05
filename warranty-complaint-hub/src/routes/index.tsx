import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Tv, Lock, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — A3 Television Service Desk" },
      {
        name: "description",
        content: "Sign in to the A3 Television service desk to manage warranties and complaints.",
      },
      { property: "og:title", content: "Sign in — A3 Television Service Desk" },
      {
        property: "og:description",
        content: "Sign in to the A3 Television service desk to manage warranties and complaints.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Enter a username and password");
      return;
    }
    try {
      await login(username.trim(), password.trim());
      navigate({ to: "/dashboard" });
    } catch (error) {
      // Error is already handled in the login function
    }
  };

  return (
    <div className="grid h-screen overflow-hidden lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden items-center justify-center overflow-hidden bg-sidebar lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 50% 40%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative flex flex-col items-center gap-8 px-10 text-center"
        >
          <img
            src="/favicon.png"
            alt="A3 Television"
            className="w-72 rounded-2xl glow-primary"
            width={1024}
            height={1024}
          />
          <div>
            <h2 className="font-display text-3xl font-bold tracking-wide glow-text">
              Service Desk
            </h2>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              One place for warranty registration, complaint tracking, and complete
              service history for every A3 television.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/favicon.png"
              alt="A3 Television"
              className="h-12 w-12 rounded-lg object-cover glow-primary"
            />
            <div>
              <p className="font-display font-semibold tracking-wide">A3 TELEVISION</p>
              <p className="text-xs text-muted-foreground">Service Desk</p>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Sign in</h1>
              <p className="text-sm text-muted-foreground">
                Engineer & service desk access
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pl-9"
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
