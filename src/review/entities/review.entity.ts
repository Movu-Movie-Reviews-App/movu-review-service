import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class ReviewEntity {

    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({
        type: "text",
        nullable: false,
    })
    title: string;

    @Column({
        type: "text",
        nullable: false,
    })
    description: string;

    @Column({
        type: "int",
        nullable: false,
    })
    rating: number;

    @Column({
        type: 'text'
    })
    contentId: string

    @Column({
        type: 'text'
    })
    userId: string

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

}
