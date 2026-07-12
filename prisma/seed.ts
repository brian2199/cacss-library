import bcrypt from "bcryptjs";
import {
  BindingType,
  ItemFormat,
  LoanStatus,
  MembershipStatus,
  UserRole,
  Prisma,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { isProduction } from "../src/lib/env";

const DEMO_PASSWORD = "cacss-demo";

async function main() {
  if (isProduction() && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error(
      "Refusing to run destructive demo seed in production. Set ALLOW_DEMO_SEED=true to override.",
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.itemConditionHistory.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.itemCopy.deleteMany();
  await prisma.itemAuthor.deleteMany();
  await prisma.item.deleteMany();
  await prisma.author.deleteMany();
  await prisma.category.deleteMany();
  await prisma.donor.deleteMany();
  await prisma.shelfLocation.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.memberProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  const branch = await prisma.branch.create({
    data: {
      name: "CACSS Reading Room — Desert Botanical Garden Corridor",
      address: "Phoenix metro (member volunteer stewarded)",
    },
  });

  const shelfA = await prisma.shelfLocation.create({
    data: { branchId: branch.id, code: "A-REF-01", label: "Reference cactus taxonomy" },
  });
  const shelfB = await prisma.shelfLocation.create({
    data: { branchId: branch.id, code: "B-YTH-02", label: "Youth & education" },
  });
  const shelfC = await prisma.shelfLocation.create({
    data: { branchId: branch.id, code: "C-PER-01", label: "Periodicals wall" },
  });

  const donorSociety = await prisma.donor.create({
    data: { name: "CACSS acquisitions fund", notes: "Club purchases & conservation supplies." },
  });
  const donorMember = await prisma.donor.create({
    data: { name: "Anonymous collector", notes: "Signed Edgar Lamb donation batch." },
  });

  const categories = await prisma.$transaction([
    prisma.category.create({
      data: { name: "Cactus taxonomy", slug: "cactus-taxonomy" },
    }),
    prisma.category.create({
      data: { name: "Succulent monographs", slug: "succulent-monographs" },
    }),
    prisma.category.create({
      data: { name: "CSSA & society journals", slug: "cssa-journals" },
    }),
    prisma.category.create({
      data: { name: "DBG periodicals", slug: "dbg-periodicals" },
    }),
    prisma.category.create({
      data: { name: "Convention guides", slug: "convention-guides" },
    }),
    prisma.category.create({
      data: { name: "Youth collections", slug: "youth-collections" },
    }),
    prisma.category.create({
      data: { name: "DVD / media", slug: "dvd-media" },
    }),
    prisma.category.create({
      data: { name: "Archival specials", slug: "archival-specials" },
    }),
  ]);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@cacss.library",
      name: "Jordan Vale",
      role: UserRole.ADMIN,
      passwordHash,
      memberProfile: {
        create: {
          membershipStatus: MembershipStatus.HONORARY,
          favoriteTopics: ["Agavaceae", "Sonoran ecology"],
        },
      },
    },
    include: { memberProfile: true },
  });

  const librarianUser = await prisma.user.create({
    data: {
      email: "librarian@cacss.library",
      name: "Sam Herrera",
      role: UserRole.LIBRARIAN,
      passwordHash,
      memberProfile: {
        create: {
          membershipStatus: MembershipStatus.ACTIVE,
          favoriteTopics: ["Haworthia", "Convention history"],
        },
      },
    },
    include: { memberProfile: true },
  });

  const memberUser = await prisma.user.create({
    data: {
      email: "member@cacss.library",
      name: "Alex Chen",
      role: UserRole.MEMBER,
      passwordHash,
      memberProfile: {
        create: {
          membershipStatus: MembershipStatus.ACTIVE,
          favoriteTopics: ["South African succulents"],
          phone: "+1 480 555 0199",
        },
      },
    },
    include: { memberProfile: true },
  });

  async function ensureAuthors(names: string[]) {
    const authors: { id: string; displayName: string }[] = [];
    for (const displayName of names) {
      const normalized = displayName.trim().toLowerCase().replace(/\s+/g, " ");
      const row = await prisma.author.upsert({
        where: { normalizedName: normalized },
        create: { normalizedName: normalized, displayName },
        update: {},
      });
      authors.push(row);
    }
    return authors;
  }

  async function addItem(
    data: Omit<Prisma.ItemCreateInput, "authors" | "copies" | "category" | "branch"> & {
      authorNames: string[];
      categoryIdx: number;
      copies: Array<{
        shelf?: typeof shelfA;
        barcode?: string;
        donor?: typeof donorSociety;
        damaged?: boolean;
        missing?: boolean;
      }>;
    },
  ) {
    const authors = await ensureAuthors(data.authorNames);
    const { authorNames: _a, categoryIdx, copies, ...rest } = data;
    const item = await prisma.item.create({
      data: {
        ...rest,
        category: { connect: { id: categories[categoryIdx].id } },
        branch: { connect: { id: branch.id } },
        authors: {
          create: authors.map((a, i) => ({
            authorId: a.id,
            sortOrder: i,
          })),
        },
        copies: {
          create: copies.map((c, idx) => ({
            copyNumber: idx + 1,
            barcode: c.barcode ?? `CACSS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
            shelfLocationId: c.shelf?.id,
            donorId: c.donor?.id,
            damaged: c.damaged ?? false,
            missing: c.missing ?? false,
          })),
        },
      },
      include: { copies: true },
    });
    return item;
  }

  await addItem({
    title: "Britton & Rose — The Cactaceae",
    subtitle: "Vintage multi-volume survey",
    format: ItemFormat.BOOK,
    publicationYear: 1923,
    publisher: "Carnegie Institution",
    bindingType: BindingType.HARDCOVER,
    pages: 1200,
    language: "en",
    rarityScore: 10,
    estimatedValue: new Prisma.Decimal("850.00"),
    rareProtected: true,
    requiresRareApproval: true,
    fragile: true,
    outOfPrint: true,
    archival: true,
    signedEdition: false,
    loanDaysRare: 7,
    loanDaysDefault: 14,
    botanicalGenera: ["Opuntia", "Cereus", "Echinocactus"],
    tags: ["Britton", "Rose", "historic"],
    notes: "Reading-room handling required; cotton gloves in drawer.",
    authorNames: ["Nathaniel Lord Britton", "Joseph Nelson Rose"],
    categoryIdx: 0,
    copies: [{ shelf: shelfA, barcode: "CACSS-BR-1923-01", donor: donorSociety }],
  });

  await addItem({
    title: "Edgar Lamb — Illustrated Reference on Cacti & Other Succulents",
    subtitle: "Signed collector copy",
    format: ItemFormat.BOOK,
    publicationYear: 1955,
    publisher: "Abbey Garden Press",
    bindingType: BindingType.HARDCOVER,
    rarityScore: 9,
    estimatedValue: new Prisma.Decimal("425.00"),
    rareProtected: true,
    requiresRareApproval: true,
    signedEdition: true,
    outOfPrint: true,
    botanicalGenera: ["Mixed genera"],
    tags: ["Lamb", "signed"],
    notes: "Donated with correspondence tucked in sleeve.",
    authorNames: ["Edgar Lamb"],
    categoryIdx: 1,
    copies: [
      { shelf: shelfA, barcode: "CACSS-LAMB-SIGNED", donor: donorMember },
      {
        shelf: shelfA,
        barcode: "CACSS-LAMB-READ-COPY",
        donor: donorSociety,
        damaged: true,
      },
    ],
  });

  await addItem({
    title: "Haworthia Updates — Collector essays",
    format: ItemFormat.JOURNAL,
    publicationYear: 1998,
    rarityScore: 6,
    botanicalGenera: ["Haworthia"],
    tags: ["South Africa", "windows plants"],
    authorNames: ["Bruce Bayer"],
    categoryIdx: 1,
    copies: [{ shelf: shelfA, barcode: "CACSS-HAW-1998" }],
  });

  await addItem({
    title: "CSSA Journal compilation binders",
    format: ItemFormat.JOURNAL,
    publicationYear: 1985,
    tags: ["CSSA"],
    authorNames: ["Cactus & Succulent Society of America"],
    categoryIdx: 2,
    copies: [{ shelf: shelfC, barcode: "CACSS-CSSA-BINDER-A" }],
  });

  await addItem({
    title: "Desert Botanical Garden — Sonoran Quarterly inserts",
    format: ItemFormat.MAGAZINE,
    publicationYear: 1992,
    botanicalGenera: ["Agave", "Fouquieria"],
    tags: ["DBG", "Arizona"],
    authorNames: ["Desert Botanical Garden"],
    categoryIdx: 3,
    copies: [{ shelf: shelfC }],
  });

  await addItem({
    title: "Euphorbia Journal — cyathium morphology issue run",
    format: ItemFormat.JOURNAL,
    publicationYear: 2001,
    botanicalGenera: ["Euphorbia"],
    tags: ["madascar", "latex"],
    authorNames: ["David Bruyns", "Susan Carter Holmes"],
    categoryIdx: 1,
    copies: [{ shelf: shelfC }],
  });

  await addItem({
    title: "CACSS Winter Rendezvous — Program & vendor guide",
    format: ItemFormat.CONVENTION_GUIDE,
    publicationYear: 2019,
    tags: ["convention", "speakers"],
    authorNames: ["Central Arizona Cactus and Succulent Society"],
    categoryIdx: 4,
    copies: [{ shelf: shelfB, barcode: "CACSS-CONV-2019" }],
  });

  await addItem({
    title: "Lithops treasures — youth-friendly primer",
    format: ItemFormat.YOUTH_BOOK,
    publicationYear: 2014,
    botanicalGenera: ["Lithops"],
    tags: ["stem club"],
    authorNames: ["Martha Lomeli"],
    categoryIdx: 5,
    copies: [{ shelf: shelfB }],
  });

  await addItem({
    title: "Agaves of Continental North America",
    format: ItemFormat.BOOK,
    publicationYear: 1982,
    botanicalGenera: ["Agave"],
    tags: ["reference"],
    referenceOnly: true,
    checkoutEligible: false,
    authorNames: ["Howard Scott Gentry"],
    categoryIdx: 0,
    copies: [{ shelf: shelfA }],
  });

  await addItem({
    title: "DVD — Xerophyte propagation lab tour",
    format: ItemFormat.DVD,
    publicationYear: 2009,
    tags: ["education"],
    authorNames: ["DBG Education Staff"],
    categoryIdx: 6,
    copies: [{ shelf: shelfB }],
  });

  await addItem({
    title: "Photo booklet — Arizona native Echinocereus locales",
    format: ItemFormat.BOOKLET,
    publicationYear: 1978,
    botanicalGenera: ["Echinocereus"],
    tags: ["field notes"],
    rarityScore: 7,
    fragile: true,
    authorNames: ["Frank Reich"],
    categoryIdx: 7,
    copies: [{ shelf: shelfA, missing: true }],
  });

  await addItem({
    title: "Photocopy packet — vintage lithops cultivation charts",
    format: ItemFormat.PHOTOCOPY,
    publicationYear: 1990,
    fragile: true,
    botanicalGenera: ["Lithops"],
    tags: ["photocopy"],
    authorNames: ["CACSS Education Committee"],
    categoryIdx: 7,
    copies: [{ shelf: shelfB }],
  });

  await addItem({
    title: "Brittlebush archives — club newsletters on microfilm surrogate folder",
    format: ItemFormat.ARCHIVAL_COLLECTION,
    publicationYear: 1965,
    archival: true,
    doNotRemoveFromLibrary: true,
    checkoutEligible: false,
    referenceOnly: true,
    tags: ["newsletters"],
    authorNames: ["CACSS Historians Circle"],
    categoryIdx: 7,
    copies: [{ shelf: shelfA }],
  });

  const haworthia = await prisma.item.findFirst({
    where: { title: { contains: "Haworthia" } },
    include: { copies: true },
  });
  const dvd = await prisma.item.findFirst({
    where: { format: ItemFormat.DVD },
    include: { copies: true },
  });

  if (
    haworthia?.copies[0] &&
    memberUser.memberProfile &&
    librarianUser.memberProfile
  ) {
    await prisma.loan.create({
      data: {
        memberProfileId: memberUser.memberProfile.id,
        itemCopyId: haworthia.copies[0].id,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
        status: LoanStatus.ACTIVE,
        approvedByUserId: librarianUser.id,
        dueDateAcknowledgedAt: new Date(),
      },
    });
  }

  if (dvd?.copies[0] && adminUser.memberProfile) {
    await prisma.loan.create({
      data: {
        memberProfileId: adminUser.memberProfile.id,
        itemCopyId: dvd.copies[0].id,
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        status: LoanStatus.ACTIVE,
        approvedByUserId: adminUser.id,
      },
    });
  }

  const lamb = await prisma.item.findFirst({
    where: { signedEdition: true },
    include: { copies: true },
  });
  if (lamb?.copies[0] && memberUser.memberProfile) {
    await prisma.loan.create({
      data: {
        memberProfileId: memberUser.memberProfile.id,
        itemCopyId: lamb.copies[0].id,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
        status: LoanStatus.PENDING_RARE_APPROVAL,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: "IMPORT",
      entityType: "seed",
      summary: "Loaded demonstration desert botanical inventory",
    },
  });

  console.log("Seed complete.");
  console.log("Accounts (password for all):", DEMO_PASSWORD);
  console.log("- Admin:", adminUser.email);
  console.log("- Librarian:", librarianUser.email);
  console.log("- Member:", memberUser.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
