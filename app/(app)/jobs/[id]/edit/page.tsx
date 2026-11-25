import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data/context";
import { PageHeader } from "@/components/ui";
import { JobForm } from "../../job-form";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo } = await requireContext();
  const job = await repo.getJob(id);
  if (!job) notFound();
  return (
    <>
      <PageHeader title={`Edit ${job.name}`} />
      <JobForm job={job} />
    </>
  );
}
