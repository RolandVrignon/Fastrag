import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: {
        id: Number(projectId),
        userId: session.user.id, // Ensure user owns the project
      },
      include: {
        documents: true,
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Convert BigInts to strings before sending
    const safeProject = {
      ...project,
      id: project.id.toString(),
      documents: project.documents.map(doc => ({
        ...doc,
        id: doc.id.toString(),
        projectId: doc.projectId.toString(),
      })),
    };

    return NextResponse.json(safeProject);
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch project details" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Not authenticated", { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // First, verify the user owns the project
    const project = await prisma.project.findUnique({
      where: {
        id: Number(projectId),
        userId: session.user.id,
      },
    });

    if (!project) {
      return new NextResponse("Project not found or you do not have access", { status: 404 });
    }

    // Now, delete the project. The database will cascade the delete to documents.
    await prisma.project.delete({
      where: {
        id: Number(projectId),
      },
    });

    return new NextResponse(null, { status: 204 }); // 204 No Content is standard for successful DELETE
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    return new NextResponse("Failed to delete project", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Not authenticated", { status: 401 });
  }

  const { id: projectId } = await params;
  const { name: newName } = await request.json();

  if (!newName) {
    return new NextResponse("New name is required", { status: 400 });
  }

  try {
    // First, verify the user owns the project he is trying to update
    const project = await prisma.project.findUnique({
      where: { id: Number(projectId), userId: session.user.id },
    });

    if (!project) {
      return new NextResponse("Project not found or you do not have access", { status: 404 });
    }

    // Update the project name
    const updatedProject = await prisma.project.update({
      where: {
        id: Number(projectId),
      },
      data: {
        name: newName,
      },
    });

    return NextResponse.json({
        ...updatedProject,
        id: updatedProject.id.toString(),
    });

  } catch (error) {
    console.error(`Error updating project ${projectId}:`, error);
     // Handle potential unique constraint violation for project name
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
       return new NextResponse("A project with this name already exists.", { status: 409 });
    }
    return new NextResponse("Failed to update project", { status: 500 });
  }
}