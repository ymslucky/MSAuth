import { createSubjects } from "@openauthjs/openauth/subject";
import { array, object, string } from "valibot";

// This value should be shared between the OpenAuth server Worker and other
// client Workers that you connect to it, so the types and schema validation
// are consistent.
export const subjects = createSubjects({
	user: object({
		id: string(),
		roles: array(string()),
	}),
});