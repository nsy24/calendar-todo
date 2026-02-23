-- アバター用 seed（DiceBear 用）。空の場合はユーザー名を seed として利用
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_seed text;
