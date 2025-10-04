import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommentWithUser } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";

interface CommentSectionProps {
  scanId: string;
}

export function CommentSection({ scanId }: CommentSectionProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/scans", scanId, "comments"],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/scans/${scanId}/comments`, {
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans", scanId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      setNewComment("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && user) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-3 pt-3 border-t" data-testid={`comments-section-${scanId}`}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-2"
              data-testid={`comment-${comment.id}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.user.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(comment.user.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold" data-testid={`comment-username-${comment.id}`}>
                    {comment.user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <p className="text-sm" data-testid={`comment-content-${comment.id}`}>{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {user && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="h-10"
            data-testid={`input-comment-${scanId}`}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newComment.trim() || addCommentMutation.isPending}
            data-testid={`button-submit-comment-${scanId}`}
            className="h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
