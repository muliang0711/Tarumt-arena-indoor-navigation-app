package ports

type IdentityService interface {
	DeriveDeviceReference(installationID string) (string, error)
}
