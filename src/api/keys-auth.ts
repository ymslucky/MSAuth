export interface ApiKeyAuth {
	userId: string;
	scopes: Set<string>;
	keyId: string;
}