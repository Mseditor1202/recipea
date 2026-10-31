import React, { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { storage } from "@/lib/firebase";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    setDisplayName(user.displayName || "");
    setPreviewUrl(user.photoURL || "");
  }, [user]);

  useEffect(() => {
    if (!imageFile) return;

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  const handleSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("JPEG・PNG・WebP形式の画像を選んでください。");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("画像サイズは5MB以下にしてください。");
      return;
    }

    setError("");
    setImageFile(file);
  };

  const handleSave = async () => {
    if (!user) return;

    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError("表示名を入力してください。");
      return;
    }

    if (trimmedName.length > 20) {
      setError("表示名は20文字以内で入力してください。");
      return;
    }

    try {
      setSaving(true);
      setError("");

      let photoURL = user.photoURL;

      if (imageFile) {
        const extension = imageFile.name.split(".").pop() || "jpg";

        const storageRef = ref(
          storage,
          `profileImages/${user.uid}/avatar.${extension}`,
        );

        await uploadBytes(storageRef, imageFile);

        photoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(user, {
        displayName: trimmedName,
        photoURL,
      });

      await router.replace("/mypage");
    } catch (saveError: unknown) {
      console.error("[PROFILE] update failed:", saveError);
      setError("プロフィールの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <AppLayout title="プロフィール編集" activeNav="mypage">
        <Box
          sx={{
            minHeight: 400,
            display: "grid",
            placeItems: "center",
          }}
        >
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="プロフィール編集" activeNav="mypage">
      <Box
        sx={{
          width: "100%",
          maxWidth: 560,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 5 },
        }}
      >
        <Stack spacing={4}>
          {/* プロフィール画像 */}
          <Box
            sx={{
              textAlign: "center",
            }}
          >
            <Avatar
              src={previewUrl || undefined}
              alt={displayName || "プロフィール画像"}
              sx={{
                width: 120,
                height: 120,
                mx: "auto",
                bgcolor: "#FFF3E0",
                color: "#D98300",
                border: "2px solid #F3D6A3",
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              {(displayName || "U").slice(0, 1)}
            </Avatar>

            <Button
              component="label"
              variant="outlined"
              disabled={saving}
              sx={{
                mt: 2,
                borderRadius: 999,
                borderColor: "#F2C98C",
                color: "#B86E00",
                fontWeight: 700,
                fontSize: 13,
                textTransform: "none",
                "&:hover": {
                  borderColor: "#FFB830",
                  bgcolor: "#FFF8EC",
                },
              }}
            >
              画像を変更
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleSelectImage}
              />
            </Button>

            <Typography
              sx={{
                mt: 1,
                fontSize: 11,
                color: "#999999",
              }}
            >
              JPEG・PNG・WebP / 5MBまで
            </Typography>
          </Box>

          {/* 表示名 */}
          <Box>
            <Typography
              component="label"
              htmlFor="display-name"
              sx={{
                mb: 1,
                display: "block",
                fontSize: 14,
                fontWeight: 700,
                color: "#333333",
              }}
            >
              表示名
            </Typography>

            <TextField
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={saving}
              fullWidth
              inputProps={{
                maxLength: 20,
              }}
              helperText={`${displayName.length} / 20`}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: "#FFFFFF",
                },
              }}
            />
          </Box>

          {/* メール */}
          {user?.email && (
            <Box>
              <Typography
                sx={{
                  mb: 1,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#333333",
                }}
              >
                メールアドレス
              </Typography>

              <Box
                sx={{
                  px: 2,
                  py: 1.7,
                  borderRadius: 3,
                  bgcolor: "#F7F7F7",
                  color: "#777777",
                  fontSize: 14,
                }}
              >
                {user.email}
              </Box>

              <Typography
                sx={{
                  mt: 0.8,
                  fontSize: 11,
                  color: "#999999",
                }}
              >
                β版ではメールアドレスを変更できません
              </Typography>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {/* 保存 */}
          <Button
            type="button"
            variant="contained"
            fullWidth
            disabled={saving || !displayName.trim()}
            onClick={handleSave}
            sx={{
              minHeight: 54,
              borderRadius: 3,
              bgcolor: "#22863A",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 800,
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#1C7432",
                boxShadow: "none",
              },
            }}
          >
            {saving ? (
              <>
                <CircularProgress
                  size={20}
                  sx={{
                    mr: 1.5,
                    color: "#FFFFFF",
                  }}
                />
                保存中...
              </>
            ) : (
              "変更を保存"
            )}
          </Button>

          <Button
            type="button"
            variant="text"
            disabled={saving}
            onClick={() => router.back()}
            sx={{
              color: "#777777",
              fontWeight: 700,
              textTransform: "none",
            }}
          >
            キャンセル
          </Button>
        </Stack>
      </Box>
    </AppLayout>
  );
}
