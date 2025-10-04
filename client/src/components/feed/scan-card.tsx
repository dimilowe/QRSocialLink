import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, ExternalLink, UserPlus, UserCheck, Edit, Sparkles } from "lucide-react";
import { ScanWithUser } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { CommentSection } from "./comment-section";

interface ScanCardProps {
  scan: ScanWithUser;
  currentUserId?: string;
  currentUserPlan?: string;
  onLike: (scanId: string) => void;
  onFollow: (userId: string) => void;
  onRescan: (url: string) => void;
  onEdit?: (scan: ScanWithUser) => void;
  isFollowing: boolean;
}

export function ScanCard({
  scan,
  currentUserId,
  currentUserPlan,
  onLike,
  onFollow,
  onRescan,
  onEdit,
  isFollowing,
}: ScanCardProps) {
  const [showComments, setShowComments] = useState(false);
  const isOwnScan = currentUserId === scan.userId;
  const canEdit = isOwnScan && currentUserPlan === "pro" && onEdit;

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const handleRescan = () => {
    const targetUrl = scan.redirectUrl || scan.decodedUrl;
    let urlToOpen = targetUrl;
    if (!targetUrl.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
      urlToOpen = `https://${targetUrl}`;
    }
    window.open(urlToOpen, "_blank");
    onRescan(targetUrl);
  };

  return (
    <Card className="p-4 space-y-3" data-testid={`card-scan-${scan.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10" data-testid={`avatar-user-${scan.user.id}`}>
            <AvatarImage src={scan.user.avatarUrl || undefined} />
            <AvatarFallback>{getInitials(scan.user.username)}</AvatarFallback>
          </Avatar>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate" data-testid={`text-username-${scan.user.id}`}>
                {scan.user.username}
              </p>
              {scan.user.plan === "pro" && (
                <Badge
                  variant="outline"
                  className="bg-gradient-to-r from-[hsl(var(--pro-badge-from))] to-[hsl(var(--pro-badge-to))] text-white border-0 px-2 py-0.5"
                  data-testid="badge-pro"
                >
                  PRO
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-timestamp">
              {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {!isOwnScan && (
          <Button
            variant={isFollowing ? "secondary" : "outline"}
            size="sm"
            onClick={() => onFollow(scan.userId)}
            data-testid={`button-follow-${scan.user.id}`}
            className="h-8"
          >
            {isFollowing ? (
              <>
                <UserCheck className="h-4 w-4 mr-1" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Follow
              </>
            )}
          </Button>
        )}
      </div>

      <div
        className="bg-white rounded-lg p-4 aspect-square flex items-center justify-center cursor-pointer hover-elevate active-elevate-2"
        onClick={handleRescan}
        data-testid={`image-qr-${scan.id}`}
      >
        <img
          src={scan.qrImageUrl}
          alt="QR Code"
          className="max-w-full max-h-full object-contain"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {scan.title && (
            <p className="font-medium" data-testid="text-scan-title">{scan.title}</p>
          )}
          {scan.type === "created" && (
            <Badge variant="secondary" className="gap-1" data-testid="badge-created">
              <Sparkles className="h-3 w-3" />
              Created
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1 min-w-0">
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            <a
              href={scan.redirectUrl || scan.decodedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-foreground transition-colors"
              data-testid="link-decoded-url"
            >
              {scan.redirectUrl || scan.decodedUrl}
            </a>
          </div>
          
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(scan)}
              data-testid={`button-edit-${scan.id}`}
              className="flex-shrink-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {scan.redirectUrl && (
          <p className="text-xs text-muted-foreground">
            Original: {scan.decodedUrl}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLike(scan.id)}
          data-testid={`button-like-${scan.id}`}
          className={cn(
            "gap-2",
            scan.isLiked && "text-red-500"
          )}
        >
          <Heart className={cn("h-5 w-5", scan.isLiked && "fill-current")} />
          <span data-testid={`text-likes-count-${scan.id}`}>{scan.likesCount}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          data-testid={`button-comments-${scan.id}`}
          className="gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          <span data-testid={`text-comments-count-${scan.id}`}>{scan.commentsCount}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRescan}
          data-testid={`button-rescan-${scan.id}`}
          className="gap-2 ml-auto"
        >
          <ExternalLink className="h-5 w-5" />
          Rescan
        </Button>
      </div>

      {showComments && (
        <CommentSection scanId={scan.id} />
      )}
    </Card>
  );
}
