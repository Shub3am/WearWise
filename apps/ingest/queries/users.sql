-- name: FindUserIDWithHealthDataConsent :one
SELECT users.id FROM users
WHERE users.clerk_user_id = sqlc.arg(clerk_user_id)
  AND EXISTS (
    SELECT 1 FROM consents
    WHERE consents.user_id = users.id AND consents.kind = 'health_data_processing'
  );
